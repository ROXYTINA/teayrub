# CloudDraw Glossary

| Term | Definition |
| :--- | :--- |
| **Availability Zone (AZ)** | An isolated data center location within an AWS Region with independent power, cooling, and networking. |
| **Stateless Server** | A backend server that stores no session or game state in local memory/disk, allowing any instance to handle any request. |
| **Redis Pub/Sub** | A publish/subscribe messaging pattern in Redis used to broadcast real-time events (strokes, chat) across multiple servers. |
| **VPC (Virtual Private Cloud)** | A logically isolated virtual network in AWS where you define IP ranges, subnets, route tables, and security controls. |
| **Security Group** | A stateful virtual firewall attached to AWS resources (ALB, ECS tasks, Redis) that controls inbound and outbound traffic. |
| **IaC (Infrastructure as Code)** | Managing and provisioning cloud infrastructure using declarative configuration files (e.g., Terraform) rather than manual clicks. |
| **Normalized Coordinates** | Representing canvas positions as fractions in `[0, 1]` rather than pixels so drawings scale identically across screen sizes. |
| **Stroke Batching** | Grouping multiple pointer points into a single message every ~40 ms to reduce WebSocket and Pub/Sub overhead. |
| **Pointer Events** | A unified browser event model (`pointerdown`, `pointermove`, `pointerup`) supporting mouse, touch, and pen input. |
