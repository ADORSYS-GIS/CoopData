terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Automatically Generate SSH Private Key & AWS Key Pair ─────────────────────
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated" {
  key_name   = "coopdata-${var.environment}-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

resource "local_sensitive_file" "private_key_pem" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/coopdata-key.pem"
  file_permission = "0400"
}

# ── Data: Latest Ubuntu 22.04 LTS AMI ─────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] # Canonical
}

# ── VPC & Networking ──────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "coopdata-${var.environment}-vpc"
    Environment = var.environment
    Project     = "CoopData"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "coopdata-${var.environment}-igw"
    Environment = var.environment
    Project     = "CoopData"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true

  tags = {
    Name        = "coopdata-${var.environment}-public-subnet"
    Environment = var.environment
    Project     = "CoopData"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "coopdata-${var.environment}-public-rt"
    Environment = var.environment
    Project     = "CoopData"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ── Security Group ────────────────────────────────────────────────────────────
resource "aws_security_group" "ec2" {
  name        = "coopdata-${var.environment}-sg"
  description = "Security group for CoopData EC2 deployment"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP Traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS Traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "coopdata-${var.environment}-sg"
    Environment = var.environment
    Project     = "CoopData"
  }
}

# ── EC2 Instance ──────────────────────────────────────────────────────────────
resource "aws_instance" "server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.generated.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
  }

  user_data = <<-EOF
              #!/bin/bash
              set -euo pipefail
              
              # System packages
              apt-get update -y
              apt-get install -y git curl ca-certificates gnupg lsb-release nginx
              
              # Install Docker & Docker Compose V2
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg
              
              echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null
                
              apt-get update -y
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              
              # Add ubuntu user to docker group
              usermod -aG docker ubuntu
              
              # Set up swap space (2GB) for stability
              fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
              chmod 600 /swapfile
              mkswap /swapfile
              swapon /swapfile
              echo '/swapfile none swap sw 0 0' >> /etc/fstab
              
              # Clone CoopData repository for ubuntu user
              sudo -u ubuntu git clone ${var.repo_url} /home/ubuntu/CoopData
              chown -R ubuntu:ubuntu /home/ubuntu/CoopData
              EOF

  tags = {
    Name        = "coopdata-${var.environment}-server"
    Environment = var.environment
    Project     = "CoopData"
  }

  depends_on = [aws_key_pair.generated]
}

# ── Elastic IP ────────────────────────────────────────────────────────────────
resource "aws_eip" "server_ip" {
  instance = aws_instance.server.id
  domain   = "vpc"

  tags = {
    Name        = "coopdata-${var.environment}-eip"
    Environment = var.environment
    Project     = "CoopData"
  }
}
