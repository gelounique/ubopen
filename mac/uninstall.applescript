-- UBOpen & Convert by gelounique — Deinstallation (macOS)
set appName to "UBOpen & Convert"
try
	display dialog "UBOpen & Convert vollständig entfernen?" & return & return & "Programm, Einstellungen, Verlauf und Vorschau-Cache werden gelöscht. Deine eigenen Dateien bleiben unberührt." buttons {"Abbrechen", "Entfernen"} default button "Entfernen" cancel button "Abbrechen" with title "UBOpen deinstallieren" with icon caution
on error
	return
end try
try
	tell application "UBOpen & Convert" to quit
end try
delay 1
set targets to {"/Applications/UBOpen & Convert.app", (POSIX path of (path to home folder)) & "Applications/UBOpen & Convert.app", (POSIX path of (path to home folder)) & "Library/Application Support/UBOpen & Convert", (POSIX path of (path to home folder)) & "Library/Caches/UBOpen & Convert", (POSIX path of (path to home folder)) & "Library/Caches/de.uniquebaby.ubopen", (POSIX path of (path to home folder)) & "Library/Preferences/de.uniquebaby.ubopen.plist", (POSIX path of (path to home folder)) & "Library/Saved Application State/de.uniquebaby.ubopen.savedState", (POSIX path of (path to home folder)) & "Library/Logs/UBOpen & Convert"}
set needAdmin to false
repeat with t in targets
	try
		do shell script "rm -rf " & quoted form of (t as text)
	on error
		set needAdmin to true
	end try
end repeat
try
	do shell script "rm -rf \"$TMPDIR/UBOpen\""
end try
if needAdmin then
	try
		do shell script "rm -rf '/Applications/UBOpen & Convert.app'" with administrator privileges
	end try
end if
display dialog "UBOpen & Convert wurde entfernt. Danke fürs Benutzen!" buttons {"OK"} default button "OK" with title "UBOpen deinstallieren"
