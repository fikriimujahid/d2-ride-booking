output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "nat_instance_id" {
  description = "The ID of the NAT Instance (only created in non-prod)"
  value       = try(aws_instance.nat[0].id, null)
}

output "nat_gateway_id" {
  description = "The ID of the NAT Gateway (only created in prod)"
  value       = try(aws_nat_gateway.main[0].id, null)
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "bastion_security_group_id" {
  description = "ID of the Bastion security group"
  value       = aws_security_group.bastion.id
}

output "app_security_group_id" {
  description = "ID of the Application security group"
  value       = aws_security_group.app.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}
