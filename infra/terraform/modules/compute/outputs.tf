output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "api_asg_name" {
  description = "Name of the API Auto Scaling Group"
  value       = aws_autoscaling_group.api.name
}

output "websocket_instance_id" {
  description = "ID of the WebSocket instance"
  value       = aws_instance.websocket.id
}

output "websocket_private_ip" {
  description = "Private IP of the WebSocket instance"
  value       = aws_instance.websocket.private_ip
}

output "bastion_public_ip" {
  description = "Public IP of the Bastion host"
  value       = var.enable_bastion ? aws_instance.bastion[0].public_ip : null
}

output "bastion_instance_id" {
  description = "ID of the Bastion instance"
  value       = var.enable_bastion ? aws_instance.bastion[0].id : null
}
