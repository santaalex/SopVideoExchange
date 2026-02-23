import paramiko
import sys

host = '219.151.179.8'
user = 'root'
password = 'Fuinno@251010'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(host, username=user, password=password)
    print("✅ 已成功连接到天翼云服务器，正在实时监听 Docker 日志...\n(按 Ctrl+C 停止监听)\n")
    
    # Run docker logs with Follow flag, showing only the last 50 lines to start
    stdin, stdout, stderr = ssh.exec_command('docker logs -f --tail 50 sop_video_service', get_pty=True)
    
    for line in iter(stdout.readline, ""):
        sys.stdout.write(line)
        sys.stdout.flush()
except KeyboardInterrupt:
    print("\n🛑 已退出监听。")
finally:
    ssh.close()
