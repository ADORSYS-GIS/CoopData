# 🚀 Automated Single-Node EC2 Terraform Provisioner

This Terraform module automatically provisions an EC2 instance in AWS with Ubuntu 22.04 LTS, an Elastic IP, Security Groups (ports 22, 80, 443), Docker V2, Docker Compose, Git, and automatically clones the CoopData repository.

---

## 📋 Quickstart Instructions

### 1. Generate an SSH key pair (OUTSIDE Terraform)
The private key is **never** stored in Terraform state — only the public key is imported.
```bash
ssh-keygen -t ed25519 -f ~/.ssh/coopdata-prod -C "coopdata-prod"
cat ~/.ssh/coopdata-prod.pub   # copy this value
```

### 2. Initialize Terraform
```bash
cd terraform-ec2
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set `ssh_public_key` (the public key from step 1), your desired `aws_region`, and restrict `allowed_ssh_cidr` to your office/VPN or GitHub runner egress CIDRs.

### 3. Apply Infrastructure
```bash
terraform init
terraform apply
```

### 4. SSH into the Instance & Run Initial Deployment
After `terraform apply` finishes, copy the output SSH command:

```bash
ssh -i ~/.ssh/coopdata-prod ubuntu@<PUBLIC_IP>

cd CoopData
sudo ./setup-ec2.sh
./start-prod.sh
```

### 5. Configure GitHub Secrets for Automated CI/CD
In your GitHub repo (`Settings -> Secrets and variables -> Actions`):
- `PROD_HOST`: `<PUBLIC_IP>`
- `PROD_USER`: `ubuntu`
- `PROD_SSH_KEY`: Content of your private key (`~/.ssh/coopdata-prod`)
- `PROD_PATH`: `/home/ubuntu/CoopData`

> **Note:** This module provisions a single EC2 instance in a single Availability Zone. It is not multi-AZ — an AZ failure causes a full outage. Multi-AZ (ASG + multiple subnets) is a planned enhancement.
