import paramiko
import time

def inspect_server():
    host = '219.151.179.8'
    user = 'root'
    password = 'Fuinno@251010'
    
    print(f"Connecting to {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, username=user, password=password, timeout=10)
        print("Successfully connected!\n")
        
        commands = [
            "echo '--- OS Info ---'", "uname -a", "cat /etc/os-release | grep PRETTY_NAME",
            "echo '\n--- CPU Info ---'", "lscpu | grep 'Model name\\|CPU(s):'",
            "echo '\n--- Memory Info ---'", "free -h",
            "echo '\n--- Disk Space ---'", "df -h /",
            "echo '\n--- Docker Status ---'", "docker --version", "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
        ]
        
        with open("server_report.txt", "w", encoding="utf-8") as f:
            for cmd in commands:
                stdin, stdout, stderr = ssh.exec_command(cmd)
                out = stdout.read().decode('utf-8', errors='ignore').strip()
                err = stderr.read().decode('utf-8', errors='ignore').strip()
                if cmd.startswith("echo"): 
                    f.write(f"\n{cmd.replace('echo ', '').strip('\'\"')}\n")
                else:
                    f.write(f"> {cmd}\n")
                    if out: f.write(out + "\n")
                    if err: f.write(f"ERROR: {err}\n")
                
        ssh.close()
    except Exception as e:
        print(f"SSH Connection failed: {e}")

if __name__ == '__main__':
    inspect_server()
