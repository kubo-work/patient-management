terraform {
  backend "s3" {
    bucket  = "terraform-state-patient-management-dev-kubo"
    key     = "terraform.tfstate"
    region  = "ap-northeast-1"
    profile = "patient"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                   = "ap-northeast-1"
  shared_credentials_files = ["~/.aws/credentials"]
  profile                  = "patient"
}

provider "aws" {
  alias                    = "us_east_1"
  region                   = "us-east-1"
  shared_credentials_files = ["~/.aws/credentials"]
  profile                  = "patient"
}

# ------------------------------------------------------------
# Data
# ------------------------------------------------------------
data "aws_region" "current" {}
locals {
  vpc_cidr_block = "10.0.0.0/16"
  # public_subnet_cidr_blocks  = ["10.0.3.0/24", "10.0.4.0/24"]
  private_subnet_cidr_blocks = ["10.0.1.0/24", "10.0.2.0/24"]
  availability_zones         = ["ap-northeast-1a", "ap-northeast-1c"]
}
