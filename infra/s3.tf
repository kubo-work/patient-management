resource "aws_s3_bucket" "s3" {
  bucket = "terraform-state-${var.project}-${var.environment}-kubo2026"
  tags = {
    Name = "${var.project}-${var.environment}-s3"
  }
}
