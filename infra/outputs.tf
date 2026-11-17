output "site_url" {
  value = "https://${aws_cloudfront_distribution.cdn.domain_name}"
}

output "alb_dns" {
  value = aws_lb.alb.dns_name
}

output "region" {
  value = var.region
}

output "ecr_repo_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.app.name
}

output "web_bucket" {
  value = aws_s3_bucket.web.bucket
}

output "cloudfront_id" {
  value = aws_cloudfront_distribution.cdn.id
}

output "redis_replication_group" {
  value = aws_elasticache_replication_group.redis.replication_group_id
}
