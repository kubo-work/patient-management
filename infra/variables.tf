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

variable "supabase_url" {
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
