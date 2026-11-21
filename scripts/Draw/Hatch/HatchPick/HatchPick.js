include("scripts/EAction.js");
include("../HatchDialog.js");

/**
 * Hatch by picking a point inside a closed area (AutoCAD "pick internal point").
 *
 * The boundary is found by splitting all visible lines, arcs, circles and
 * polyline segments at their mutual intersections, pruning dangling ends and
 * walking the smallest face that contains the picked point. Islands inside
 * the area are not detected yet.
 */
function HatchPick(guiAction) {
    EAction.call(this, guiAction);
    this.hatchData = undefined;
}

HatchPick.prototype = new EAction();

HatchPick.tolerance = 1.0e-6;
HatchPick.maxShapes = 3000;

HatchPick.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);

    var dialog = new HatchDialog(this);
    this.hatchData = dialog.show();
    if (isNull(this.hatchData)) {
        this.terminate();
        return;
    }

    this.getDocumentInterface().setClickMode(RAction.PickCoordinate);
    this.setCrosshairCursor();
    var trPoint = qsTr("Pick internal point");
    this.setCommandPrompt(trPoint);
    this.setLeftMouseTip(trPoint);
    this.setRightMouseTip(EAction.trCancel);
};

HatchPick.prototype.pickCoordinate = function(event, preview) {
    if (preview) {
        return;
    }

    var doc = this.getDocument();
    var di = this.getDocumentInterface();
    var loop = HatchPick.findBoundary(doc, event.getModelPosition());
    if (isNull(loop)) {
        EAction.handleUserWarning(qsTr("No closed boundary found around this point."));
        return;
    }

    var hatchData = new RHatchData();
    hatchData.setSolid(this.hatchData.isSolid());
    hatchData.setScale(this.hatchData.getScale());
    hatchData.setAngle(this.hatchData.getAngle());
    hatchData.setPatternName(this.hatchData.getPatternName());
    hatchData.newLoop();
    for (var i = 0; i < loop.length; i++) {
        hatchData.addBoundary(loop[i]);
    }

    di.applyOperation(new RAddObjectOperation(new RHatchEntity(doc, hatchData), this.getToolTitle()));
};

/**
 * Simple boundary shapes (lines and arcs) of all visible entities.
 * Circles become two half arcs so every shape has distinct end points.
 */
HatchPick.collectShapes = function(doc) {
    var ret = [];
    var ids = doc.queryAllVisibleEntities();
    for (var i = 0; i < ids.length; i++) {
        var entity = doc.queryEntityDirect(ids[i]);
        if (isNull(entity) || isHatchEntity(entity) || isTextBasedEntity(entity) || isDimensionEntity(entity)) {
            continue;
        }
        var shapes = entity.getShapes();
        for (var k = 0; k < shapes.length; k++) {
            HatchPick.addSimpleShapes(ret, shapes[k]);
        }
        if (ret.length > HatchPick.maxShapes) {
            return ret;
        }
    }
    return ret;
};

HatchPick.addSimpleShapes = function(list, shape) {
    if (isLineShape(shape) || isArcShape(shape)) {
        if (shape.getLength() > HatchPick.tolerance) {
            list.push(shape.clone());
        }
    }
    else if (isCircleShape(shape)) {
        var c = shape.getCenter();
        var r = shape.getRadius();
        list.push(new RArc(c, r, 0, Math.PI, false));
        list.push(new RArc(c, r, Math.PI, 2 * Math.PI, false));
    }
    else if (isPolylineShape(shape)) {
        var segs = shape.getExploded();
        for (var i = 0; i < segs.length; i++) {
            HatchPick.addSimpleShapes(list, segs[i]);
        }
    }
};

/**
 * Splits all shapes at their mutual intersection points.
 */
HatchPick.splitShapes = function(shapes) {
    var cuts = [];
    var i, j;
    for (i = 0; i < shapes.length; i++) {
        cuts.push([]);
    }
    for (i = 0; i < shapes.length; i++) {
        var bi = shapes[i].getBoundingBox().growXY(HatchPick.tolerance);
        for (j = i + 1; j < shapes.length; j++) {
            if (!bi.intersects(shapes[j].getBoundingBox())) {
                continue;
            }
            var ips = shapes[i].getIntersectionPoints(shapes[j], true);
            for (var k = 0; k < ips.length; k++) {
                cuts[i].push(ips[k]);
                cuts[j].push(ips[k]);
            }
        }
    }

    var ret = [];
    for (i = 0; i < shapes.length; i++) {
        var pieces = cuts[i].length === 0 ? [shapes[i]] : shapes[i].splitAt(cuts[i]);
        for (j = 0; j < pieces.length; j++) {
            if (!isNull(pieces[j]) && pieces[j].getLength() > HatchPick.tolerance) {
                ret.push(pieces[j]);
            }
        }
    }
    return ret;
};

HatchPick.nodeKey = function(v) {
    var f = 1 / (HatchPick.tolerance * 100);
    return Math.round(v.x * f) + "/" + Math.round(v.y * f);
};

/**
 * Builds directed half edges. Edge 2k and 2k+1 are twins (piece k forward and
 * reversed). Dangling pieces (an end with no other piece attached) are pruned
 * repeatedly, since no closed face can run through them.
 */
HatchPick.buildGraph = function(pieces) {
    var alive = [];
    var degree = {};
    var i;
    for (i = 0; i < pieces.length; i++) {
        alive.push(true);
        var a = HatchPick.nodeKey(pieces[i].getStartPoint());
        var b = HatchPick.nodeKey(pieces[i].getEndPoint());
        degree[a] = (degree[a] || 0) + 1;
        degree[b] = (degree[b] || 0) + 1;
    }

    var changed = true;
    while (changed) {
        changed = false;
        for (i = 0; i < pieces.length; i++) {
            if (!alive[i]) {
                continue;
            }
            var sa = HatchPick.nodeKey(pieces[i].getStartPoint());
            var sb = HatchPick.nodeKey(pieces[i].getEndPoint());
            if (degree[sa] < 2 || degree[sb] < 2) {
                alive[i] = false;
                degree[sa]--;
                degree[sb]--;
                changed = true;
            }
        }
    }

    var edges = [];
    var outgoing = {};
    for (i = 0; i < pieces.length; i++) {
        if (!alive[i]) {
            continue;
        }
        var fwd = pieces[i].clone();
        var rev = pieces[i].clone();
        rev.reverse();
        var pair = [fwd, rev];
        for (var k = 0; k < 2; k++) {
            var e = {
                shape: pair[k],
                id: edges.length,
                from: HatchPick.nodeKey(pair[k].getStartPoint()),
                to: HatchPick.nodeKey(pair[k].getEndPoint())
            };
            edges.push(e);
            if (isNull(outgoing[e.from])) {
                outgoing[e.from] = [];
            }
            outgoing[e.from].push(e);
        }
    }
    return { edges: edges, outgoing: outgoing };
};

HatchPick.twin = function(edges, e) {
    return edges[e.id % 2 === 0 ? e.id + 1 : e.id - 1];
};

/**
 * Next edge of the face on the left of e: the outgoing edge with the smallest
 * clockwise angle from the direction pointing back along e.
 */
HatchPick.nextEdge = function(graph, e) {
    var back = e.shape.getDirection2();
    var twin = HatchPick.twin(graph.edges, e);
    var best = undefined;
    var bestAngle = 0;
    var cands = graph.outgoing[e.to];
    for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        var cw = RMath.getNormalizedAngle(back - c.shape.getDirection1());
        if (c.id === twin.id || cw < 1.0e-9) {
            cw = 2 * Math.PI;
        }
        if (isNull(best) || cw < bestAngle) {
            best = c;
            bestAngle = cw;
        }
    }
    return best;
};

HatchPick.tangentAt = function(shape, p) {
    if (isLineShape(shape)) {
        return shape.getEndPoint().operator_subtract(shape.getStartPoint());
    }
    var r = p.operator_subtract(shape.getCenter());
    var t = new RVector(-r.y, r.x);
    return shape.isReversed() ? t.getNegated() : t;
};

/**
 * Signed area of a closed loop, arcs approximated by sampling.
 */
HatchPick.signedArea = function(loop) {
    var pts = [];
    for (var i = 0; i < loop.length; i++) {
        var s = loop[i];
        pts.push(s.getStartPoint());
        if (isArcShape(s)) {
            var n = 16;
            var sweep = s.getSweep();
            for (var k = 1; k < n; k++) {
                pts.push(s.getCenter().operator_add(RVector.createPolar(s.getRadius(), s.getStartAngle() + sweep * k / n)));
            }
        }
    }
    var a = 0;
    for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        var q = pts[(j + 1) % pts.length];
        a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
};

HatchPick.findBoundary = function(doc, point) {
    var shapes = HatchPick.collectShapes(doc);
    if (shapes.length === 0 || shapes.length > HatchPick.maxShapes) {
        return undefined;
    }
    var graph = HatchPick.buildGraph(HatchPick.splitShapes(shapes));
    if (graph.edges.length === 0) {
        return undefined;
    }

    // An odd ray angle avoids hitting vertices and tangents head-on:
    var box = doc.getBoundingBox();
    var far = box.getWidth() + box.getHeight() + point.getDistanceTo(box.getCenter()) + 1;
    var ray = new RLine(point, point.operator_add(RVector.createPolar(far, 0.1234)));

    var start = undefined;
    var bestDist = undefined;
    for (var i = 0; i < graph.edges.length; i += 2) {
        var e = graph.edges[i];
        var ips = ray.getIntersectionPoints(e.shape, true);
        for (var k = 0; k < ips.length; k++) {
            var d = point.getDistanceTo(ips[k]);
            if (isNull(bestDist) || d < bestDist) {
                bestDist = d;
                var t = HatchPick.tangentAt(e.shape, ips[k]);
                var toPoint = point.operator_subtract(ips[k]);
                // left normal of the edge direction:
                var leftSide = (-t.y * toPoint.x + t.x * toPoint.y) > 0;
                start = leftSide ? e : HatchPick.twin(graph.edges, e);
            }
        }
    }
    if (isNull(start)) {
        return undefined;
    }

    var loop = [];
    var cur = start;
    var guard = graph.edges.length + 1;
    do {
        loop.push(cur.shape.clone());
        cur = HatchPick.nextEdge(graph, cur);
        if (isNull(cur) || --guard < 0) {
            return undefined;
        }
    } while (cur.id !== start.id);

    // A negative area means the walk went around the outside of a figure:
    // the point is not enclosed.
    if (HatchPick.signedArea(loop) <= 0) {
        return undefined;
    }
    return loop;
};
