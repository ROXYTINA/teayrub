terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = var.project }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "me" {}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2) # AZ-1 and AZ-2
}
