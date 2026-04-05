# ------------------------------------------------------------
# Variables
# ------------------------------------------------------------
variable "project" {
  type = string
}

variable "environment" {
  type = string
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

variable "domain" {
  default = "patient-management-kubo-works-projects.com"
}

locals {
  front_domain = "aws.${var.domain}"
  api_domain   = "api-aws.${var.domain}"
}
