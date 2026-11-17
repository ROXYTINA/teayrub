# ---------------------------------------------------------------- Redis (Multi-AZ, auto-failover)
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project}-redis"
  subnet_ids = aws_subnet.data[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project}-redis"
  description                = "CloudDraw game state + Pub/Sub"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 2 # primary in AZ-1, replica in AZ-2
  preferred_cache_cluster_azs = local.azs
  automatic_failover_enabled = true
  multi_az_enabled           = true
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  apply_immediately          = true
}

# ---------------------------------------------------------------- DynamoDB (Multi-AZ by design)
resource "aws_dynamodb_table" "words" {
  name         = "${var.project}-words"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "word"
  attribute {
    name = "word"
    type = "S"
  }
}

resource "aws_dynamodb_table" "leaderboard" {
  name         = "${var.project}-leaderboard"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "name"
  attribute {
    name = "name"
    type = "S"
  }
}

resource "aws_dynamodb_table" "matches" {
  name         = "${var.project}-matches"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "matchId"
  attribute {
    name = "matchId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "gallery" {
  name         = "${var.project}-gallery"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "ts"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "ts"
    type = "N"
  }
}

# ---------------------------------------------------------------- S3: frontend + artwork
resource "aws_s3_bucket" "web" {
  bucket        = "${var.project}-web-${data.aws_caller_identity.me.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket" "artwork" {
  bucket        = "${var.project}-artwork-${data.aws_caller_identity.me.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "artwork" {
  bucket                  = aws_s3_bucket.artwork.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Browser uploads artwork straight to S3 with a presigned PUT -> needs CORS.
resource "aws_s3_bucket_cors_configuration" "artwork" {
  bucket = aws_s3_bucket.artwork.id
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "artwork" {
  bucket = aws_s3_bucket.artwork.id
  rule {
    id     = "expire-old-artwork"
    status = "Enabled"
    filter {}
    expiration {
      days = 60
    }
  }
}

# Only CloudFront may read the buckets (Origin Access Control).
data "aws_iam_policy_document" "web_read" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

data "aws_iam_policy_document" "artwork_read" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.artwork.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_read.json
}

resource "aws_s3_bucket_policy" "artwork" {
  bucket = aws_s3_bucket.artwork.id
  policy = data.aws_iam_policy_document.artwork_read.json
}
