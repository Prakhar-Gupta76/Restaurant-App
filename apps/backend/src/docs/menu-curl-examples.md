# Menu API cURL Examples

## Get Menu Items

```bash
curl -X GET "http://localhost:3000/api/menu?category=pizza&q=margherita&page=1&limit=12" \
  -H "Content-Type: application/json"
```

### Query Parameters

- `category` (optional): Filter by category (e.g., "pizza", "pasta", "dessert")
- `q` (optional): Search term for name and description (case-insensitive)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 12)

### Example Response

```json
{
  "items": [
    {
      "_id": "60d21b4667d0d8992e610c85",
      "name": "Margherita Pizza",
      "description": "Classic pizza with tomato sauce, mozzarella, and basil",
      "price": 12.99,
      "category": "pizza",
      "imageUrl": "https://example.com/images/margherita.jpg",
      "available": true
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 12,
    "pages": 5
  }
}
```