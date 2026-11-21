; Inno Setup 6 script for TataCAD (Windows x64).
; Normally compiled by build-windows.ps1, which passes:
;   /DAppVersion=27.0.7.0 /DSourceDir=<repo>\dist\TataCAD /DOutputDir=<repo>\dist

#ifndef AppVersion
  #define AppVersion "0.0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\dist\TataCAD"
#endif
#ifndef OutputDir
  #define OutputDir "..\..\dist"
#endif

#define AppName "TataCAD"
#define AppExe "qcad.exe"

[Setup]
; Fixed AppId so upgrades replace the previous installation. Never change it.
AppId={{6F4B1E1A-7C3D-4B5A-9E62-2D8A9C4F1B37}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=TataCAD
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
LicenseFile={#SourceDir}\gpl-3.0.txt
OutputDir={#OutputDir}
OutputBaseFilename={#AppName}-{#AppVersion}-win-x64-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequiredOverridesAllowed=dialog
UninstallDisplayIcon={app}\{#AppExe}
ChangesAssociations=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "czech"; MessagesFile: "compiler:Languages\Czech.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "dxfassoc"; Description: "Open .dxf files with {#AppName}"; GroupDescription: "File associations:"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "Software\Classes\.dxf\OpenWithProgids"; ValueType: string; ValueName: "TataCAD.dxf"; ValueData: ""; Flags: uninsdeletevalue; Tasks: dxfassoc
Root: HKA; Subkey: "Software\Classes\TataCAD.dxf"; ValueType: string; ValueName: ""; ValueData: "DXF Drawing"; Flags: uninsdeletekey; Tasks: dxfassoc
Root: HKA; Subkey: "Software\Classes\TataCAD.dxf\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"; Tasks: dxfassoc
Root: HKA; Subkey: "Software\Classes\TataCAD.dxf\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""; Tasks: dxfassoc

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
