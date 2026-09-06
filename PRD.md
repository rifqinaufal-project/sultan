# Product Requirement Document (PRD)

# Personal Company Financial Tracking Application

## 1. Overview

## Purpose

This application is a lightweight financial management system designed
to replace manual Excel reporting used by company owners.

The system helps the owner record daily incoming commissions from fish
traders and daily operational expenses in a structured way.

The main goal is to provide simple financial monitoring without
requiring complex accounting software.

## Target User

Primary user: - Company owner - Single account user

## Main Problems Solved

-   Difficult Excel-based daily reporting
-   Hard to track commission history per trader
-   Difficult monthly and yearly summaries
-   Limited expense analysis

------------------------------------------------------------------------

# 2. Requirements

## Platform

-   Responsive web application
-   React-based frontend
-   Online-only system
-   Accessible from desktop, tablet, and mobile

## User Management

-   One owner account
-   Login required
-   No multi-user role for MVP

## Main Data Input

### Commission Input

Fields: - Date - Trader name - Commission amount - Notes

### Expense Input

Fields: - Date - Expense category - Amount - Description

## Data Storage

The system stores:

Commission: - Trader history - Commission amount - Date records

Expense: - Expense category - Expense history - Spending summary

------------------------------------------------------------------------

# 3. Core Features

## Dashboard

Display:

-   Commission Today
-   Expense Today
-   Net Profit Today
-   Highest Commission Trader

Formula:

Net Profit = Total Commission - Total Expense

## Commission Management

Features: - Add commission - Edit commission - Delete commission - View
trader history - View trader ranking

## Expense Management

Features: - Add expense - Edit expense - Delete expense - Filter by
category

## Category Management

Owner can: - Create category - Edit category - Delete category

Examples: - Salary - Transportation - Food - Operational - Tobacco

## Analytics

Charts:

1.  Commission vs Expense Trend

-   Line chart
-   Weekly/monthly/yearly filter

2.  Expense Distribution

-   Pie chart
-   Category breakdown

3.  Trader Ranking

-   Bar chart
-   Highest commission contributors

## Reporting

Export:

-   PDF
-   Excel

Report types:

Daily: - Commission list - Expense list - Daily profit

Monthly: - Total commission - Total expense - Profit - Trader ranking

Yearly: - Monthly comparison - Annual summary

------------------------------------------------------------------------

# 4. User Flow

## Login

Owner opens application.

↓

Enter credentials.

↓

System validates account.

↓

Open dashboard.

## Add Commission

Open Commission menu.

↓

Click Add Commission.

↓

Select trader.

↓

Input amount.

↓

Save transaction.

↓

Dashboard updates.

## Add Expense

Open Expense menu.

↓

Click Add Expense.

↓

Select category.

↓

Input amount and description.

↓

Save transaction.

↓

Dashboard updates.

## Export Report

Open Reports.

↓

Select period.

↓

Generate report.

↓

Export PDF or Excel.

------------------------------------------------------------------------

# 5. Architecture

``` mermaid
sequenceDiagram
participant Owner
participant ReactFrontend
participant BackendAPI
participant Database
participant ExportService

Owner->>ReactFrontend: Login
ReactFrontend->>BackendAPI: Authenticate
BackendAPI->>Database: Verify account
Database-->>BackendAPI: Account valid
BackendAPI-->>ReactFrontend: Session response

Owner->>ReactFrontend: Submit commission/expense
ReactFrontend->>BackendAPI: Send transaction
BackendAPI->>Database: Store data
Database-->>BackendAPI: Success
BackendAPI-->>ReactFrontend: Update dashboard

Owner->>ReactFrontend: Export report
ReactFrontend->>BackendAPI: Request report
BackendAPI->>Database: Get financial data
Database-->>BackendAPI: Return data
BackendAPI->>ExportService: Generate PDF/XLSX
ExportService-->>ReactFrontend: Download file
```

------------------------------------------------------------------------

# 6. Database Schema

``` mermaid
erDiagram

USER {
string id PK
string username
string password_hash
}

TRADER {
string id PK
string name
string phone
}

COMMISSION {
string id PK
string trader_id FK
date transaction_date
decimal amount
string notes
}

EXPENSE_CATEGORY {
string id PK
string name
}

EXPENSE {
string id PK
string category_id FK
date transaction_date
decimal amount
string description
}

TRADER ||--o{ COMMISSION : has
EXPENSE_CATEGORY ||--o{ EXPENSE : contains
USER ||--o{ COMMISSION : creates
USER ||--o{ EXPENSE : creates
```

## Entity Description

  Entity             Description
  ------------------ -------------------------------
  User               Owner login account
  Trader             Fish trader master data
  Commission         Incoming commission records
  Expense Category   Custom expense classification
  Expense            Daily operational expenses

------------------------------------------------------------------------

# 7. Design & Technical Constraints

## UI/UX Rules

The interface must be:

-   Minimal
-   Easy for older users
-   Large readable text
-   Clear buttons
-   Simple navigation

Navigation:

-   Dashboard
-   Commission
-   Expense
-   Reports
-   Settings

## Performance

Expected:

-   Dashboard load under 3 seconds
-   Transaction save under 2 seconds
-   Report generation under 10 seconds

## Error Handling

Save failure: - Keep entered data - Show retry option

Export failure: - Show error message - Allow regeneration

Validation: - Prevent incomplete submission

## Hardware

Supported: - Desktop browser - Tablet browser - Smartphone browser

No external hardware integration required.
