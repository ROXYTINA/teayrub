variable "region" {
  type    = string
  default = "ap-southeast-1" # Singapore: closest AWS region to Cambodia
}

variable "project" {
  type    = string
  default = "clouddraw"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "nat_gateway_count" {
  description = "1 = cheaper (single NAT). 2 = one NAT per AZ (true HA, double the cost)."
  type        = number
  default     = 1
}

variable "min_tasks" {
  type    = number
  default = 2 # one per AZ
}

variable "max_tasks" {
  type    = number
  default = 10
}

variable "task_cpu" {
  type    = number
  default = 512
}

variable "task_memory" {
  type    = number
  default = 1024
}

variable "conn_target" {
  description = "Auto-scaling target: average WebSocket connections per task. Use a low value (e.g. 100) to show scale-out in a demo; ~1500 for real capacity."
  type        = number
  default     = 150
}

variable "image_tag" {
  type    = string
  default = "latest"
}
