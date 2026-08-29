# ------------------------------------------------------------
# Variables
# ------------------------------------------------------------
variable "project" {
  type    = string
  default = "patient-management"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type = string
}

variable "client_url" {
  type    = string
  default = ""
}

variable "jwt_secret_key" {
  type    = string
  default = ""
}

# AWS 復帰時に RDS へ初期データを取り込む際の移行元 DB（通常は Neon）。
# 空のままなら取り込みは行われない。
variable "source_database_url" {
  type    = string
  default = ""
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "domain" {
  default = "patient-management-kubo-works-projects.com"
}

locals {
  front_domain = "aws.${var.domain}"
  api_domain   = "api-aws.${var.domain}"
}
