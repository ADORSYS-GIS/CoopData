# 🚀 Automated Single-Node EC2 Terraform Provisioner

This Terraform module automatically provisions an EC2 instance in AWS with Ubuntu 22.04 LTS, an Elastic IP, Security Groups (ports 22, 80, 443), Docker V2, Docker Compose, Git, and automatically clones the CoopData repository.

---

## 📋 Quickstart Instructions

### 1. Initialize Terraform
```bash
cd terraform-ec2
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set your `key_name` (your existing AWS SSH Key Pair name) and desired `aws_region`.

### 2. Apply Infrastructure
```bash
terraform init
terraform apply
```

### 3. SSH into the Instance & Run Initial Deployment
After `terraform apply` finishes, copy the output SSH command:

```bash
ssh -i /path/to/your-key.pem ubuntu@<PUBLIC_IP>

cd CoopData
sudo ./setup-ec2.sh
./start-prod.sh
```

### 4. Configure GitHub Secrets for Automated CI/CD
In your GitHub repo (`Settings -> Secrets and variables -> Actions`):
- `PROD_HOST`: `<PUBLIC_IP>`
- `PROD_USER`: `ubuntu`
- `PROD_SSH_KEY`: Content of your private `.pem` file
- `PROD_PATH`: `/home/ubuntu/CoopData`
