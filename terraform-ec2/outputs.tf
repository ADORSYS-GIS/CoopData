output "public_ip" {
  description = "Elastic Public IP of the EC2 Instance"
  value       = aws_eip.server_ip.public_ip
}

output "public_dns" {
  description = "Public DNS Hostname of the EC2 Instance"
  value       = aws_instance.server.public_dns
}

output "pem_file_path" {
  description = "Path to the generated SSH Private Key (.pem file)"
  value       = local_sensitive_file.private_key_pem.filename
}

output "ssh_command" {
  description = "Command to SSH into the instance"
  value       = "ssh -i ${local_sensitive_file.private_key_pem.filename} ubuntu@${aws_eip.server_ip.public_ip}"
}

output "next_steps" {
  description = "Next steps for initial deployment"
  value       = <<EOT
===================================================================
1. SSH into the server using the auto-generated key:
   ssh -i terraform-ec2/coopdata-key.pem ubuntu@${aws_eip.server_ip.public_ip}

2. Change directory on server:
   cd CoopData

3. Run EC2 setup script:
   sudo ./setup-ec2.sh

4. Start initial production stack:
   ./start-prod.sh

5. Set GitHub Action Secrets (Settings -> Secrets & Variables -> Actions):
   PROD_HOST     = ${aws_eip.server_ip.public_ip}
   PROD_USER     = ubuntu
   PROD_SSH_KEY  = (Paste contents of terraform-ec2/coopdata-key.pem)
   PROD_PATH     = /home/ubuntu/CoopData
===================================================================
EOT
}
