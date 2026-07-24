# API Documentation: GET Progress Endpoint (`/api/v1/progress`)

## Overview
The GET Progress API Endpoint retrieves detailed student learning progress for a specific academic subject.

- **Base URLs**: `/api/progress`, `/api/v1/progress`
- **HTTP Method**: `GET`
- **CORS**: Enabled for cross-origin client requests
- **Performance**: Sub-200ms target with in-memory caching
- **Authentication & RBAC**: Required (Permitted roles: `student` for own data, `teacher`, `admin`)

---

## Request Parameters

### Required Query Parameters
| Parameter | Type | Validation Rules | Description |
| :--- | :--- | :--- | :--- |
| `studentId` | `string` | Non-empty, 3-30 chars (`/^[A-Za-z0-9_-]{3,30}$/`) | Unique student identifier |
| `subject` | `string` | Non-empty, 2-100 chars | Academic subject name (Title Case normalized) |

### Example Request URL
```http
GET /api/v1/progress?studentId=STU-1001&subject=Computer%20Science HTTP/1.1
Host: api.example.com
Authorization: Bearer <JWT_TOKEN>
Cookie: XSRF-TOKEN=<CSRF_TOKEN>
x-xsrf-token: <CSRF_TOKEN>
```

---

## Response Specifications

### 1. 200 OK: Successful Progress Retrieval
```json
{
  "success": true,
  "message": "Student progress record retrieved successfully.",
  "cached": false,
  "data": {
    "id": "66a12b3c4d5e6f7a8b9c0d1e",
    "studentId": "STU-1001",
    "subject": "Computer Science",
    "grade": 92.5,
    "overallCompletionPercentage": 92.5,
    "topics": [
      {
        "topicId": "TOPIC-101",
        "title": "Data Structures & Algorithms",
        "completionStatus": "completed",
        "lastAccessed": "2026-07-24T18:30:00.000Z",
        "score": 95
      },
      {
        "topicId": "TOPIC-102",
        "title": "Object-Oriented Programming",
        "completionStatus": "in_progress",
        "lastAccessed": "2026-07-24T19:45:00.000Z",
        "score": 90
      }
    ],
    "cumulativeTimeSpentMinutes": 185,
    "latestActivityTimestamp": "2026-07-24T19:45:00.000Z",
    "remarks": "Excellent understanding of data structures",
    "date": "2026-07-24T00:00:00.000Z",
    "createdAt": "2026-07-24T10:00:00.000Z",
    "updatedAt": "2026-07-24T19:45:00.000Z"
  }
}
```

---

## Error Handling Specifications

### 1. 400 Bad Request (Missing or Invalid Query Parameters)
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Missing or malformed required query parameter 'studentId'. Must be a non-empty string."
}
```

### 2. 403 Forbidden (Unauthorized Role or Accessing Other Student's Data)
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Access denied. Client with role 'student' is not authorized to view progress for studentId 'STU-9999'."
}
```

### 3. 404 Not Found (Student or Progress Record Does Not Exist)
```json
{
  "success": false,
  "error": "Not Found",
  "message": "No progress record found for studentId 'STU-1001' and subject 'Advanced Calculus'."
}
```

### 4. 500 Internal Server Error (Database Error)
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to retrieve student progress record: Database connection timeout"
}
```
