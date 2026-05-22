ví dụ :
       Description : This Warehouse Management API application is built using Laravel 11 with a regional warehouse partitioning architecture.
      Tech Stack:
         -  Back-end: Node.js, Express,Redis
         -  Front-end:  React, Vite, Axios, Shadcn-ui,Tailwind
         -  Database: Microsoft SQL Server
         -  DevOps: Docker, Nginx, Docker Compose
       GitHub: https://github.com/duonyyy/doan
      Key features:
Architected a Distributed Database System across 3 regional sites (North/Central/South) using horizontal and derived fragmentation to ensure data locality and high availability.
Optimized Data Consistency by implementing replication for global entities (Products/Suppliers) and leveraging Linked Servers for cross-site data aggregation
Engineered Complex Business Logic via Stored Procedures and Triggers, automating real-time stock updates and enforcing strict inventory validation through ACID transactions.
Developed Analytics Dashboards with interactive charts to track regional revenue and implemented automated report generation in Excel/PDF formats.
Improved Query Performance by strategically implementing B-Tree Indexing on high-traffic columns, significantly reducing latency in large-scale data joins.

---

## Bài viết giới thiệu dự án Fooddie:

   Description: Fooddie – A scalable food ordering & delivery platform with hybrid REST + GraphQL API, real-time WebSocket, and AI-powered conversational ordering via Google Gemini.
   Tech Stack:
      - Back-end: NestJS, TypeScript, GraphQL (Apollo), pg-boss
      - AI: Google Gemini API (gemini-2.0-flash)
      - Front-end: React, Vite
      - Database: PostgreSQL, TypeORM
      - Auth & Cloud: Firebase Auth, Google Cloud Storage, Mapbox
      - DevOps: Docker, Docker Compose
   GitHub: https://github.com/WuanDuc/edutech
   Key features:
1. Integrated an AI-Powered Conversational Ordering Chatbot (FoodieBot) using Google Gemini API to understand natural language and parse menu items.
   Supports full order flow through chat: select food → confirm restaurant → choose address → place order, with dish suggestions based on order history.
2. Architected a Hybrid API Gateway with REST (Swagger) + GraphQL (Apollo) + WebSocket subscriptions.
   Enables flexible data fetching patterns and real-time order tracking via graphql-ws live data streaming.
3. Engineered Multi-Layer Auth combining Firebase Authentication with a custom RBAC engine.
   Uses Role–Permission entities, Guards, and Decorators to enforce fine-grained access control across all endpoints.
4. 
   Handles async order processing, automated email dispatch via Nodemailer, and time-based promotion scheduling.
5. 
   Powers instant messaging and push notifications between customers, restaurants, and shippers throughout the delivery lifecycle.





Description: Fooddie – A scalable food ordering & delivery platform with hybrid REST + GraphQL API, real-time WebSocket, and AI-powered conversational ordering via Google Gemini.
   Tech Stack: NestJS, TypeScript, GraphQL (Apollo), pg-boss, Google Gemini API, React, Vite, PostgreSQL, TypeORM, Firebase Auth, Google Cloud Storage, Mapbox, Docker, Docker Compose.
   GitHub: https://github.com/WuanDuc/edutech
   Key features:
- Implemented 60+ RESTful APls across modules including Authentication, Food, Restaurant, Order, Shipper and Notifications,...
- Designed relational database schema with PostgreSQL using TypeORM (21 models).
- Implemented JWT Authentication and Role-Based Access Control (RABC) supporting 5 user roles.
- AI service for detecting and classifying 30 Vietnamese dishes from images and videos using Flask, YOLOv5, and TensorFlow Lite EfficientNet.
- Built Event-Driven Job Pipeline using pg-boss (PostgreSQL-backed queue) and @nestjs/schedule.