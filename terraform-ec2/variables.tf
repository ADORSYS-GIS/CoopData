variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (e.g. prod, demo, dev)"
  type        = string
  default     = "prod"
}

variable "instance_type" {
  description = "EC2 instance type (Recommended: t3.xlarge for production, t3.large for demo)"
  type        = string
  default     = "t3.xlarge"
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 50
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the EC2 instance (Default: 0.0.0.0/0)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "repo_url" {
  description = "CoopData Git repository URL to clone on startup"
  type        = string
  default     = "https://github.com/ADORSYS-GIS/CoopData.git"
}
