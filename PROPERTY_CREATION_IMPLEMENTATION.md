# Property Creation Wizard - Complete Implementation Guide

## Overview

The Property Creation Wizard is a 4-step guided process for property owners to list their properties with multiple images and documents. It provides a smooth, intuitive experience with real-time validation and preview.

## Architecture

### Components

1. **PropertyCreationWizard.js** - Main wizard component
   - Manages all 4 steps
   - Handles form validation
   - Coordinates image and document uploads
   - Provides preview functionality

2. **ImageUploader.js** - Enhanced image upload component
   - Drag & drop support
   - Multiple file selection
   - Progress tracking
   - Set main image functionality

3. **DocumentUploader.js** - Document upload component
   - Single/multiple document upload
   - File type validation
   - Access key generation

## 4-Step Workflow

### Step 1: Property Details
**File**: `PropertyCreationWizard.js` (form section)

**Fields**:
- Property Title (required)
- Property Type (apartment, house, villa, land, commercial)
- Listing Type (sale, rent)
- Price in ETB (required)
- Location (required)
- Bedrooms, Bathrooms, Area
- Description
- Latitude, Longitude (optional)
- Condition (Excellent, Good, Fair, Needs Repair)
- Security Rating (1-4)
- Distance to Center
- Amenities (near school, hospital, market, parking)

**Validation**:
- Title must not be empty
- Price must be provided
- Latitude: -90 to 90
- Longitude: -180 to 180

**Output**: Property created in database with `status: 'pending'`

### Step 2: Upload Images
**Component**: `ImageUploader.js`

**Features**:
- Drag & drop multiple images
- Click to browse files
- Real-time preview grid
- Set main/cover image with ⭐ button
- Remove images before uploading
- Upload progress tracking
- Error handling

**Best Practices**:
- Upload 5-10 high-quality images
- First image becomes main/cover image
- Include: exterior, living room, bedrooms, kitchen, bathrooms, parking
- Use high-resolution images (1920x1080+)
- Ensure good lighting

**Output**: Images stored in `property_images` table
- First image: `image_type = 'main'`
- Others: `image_type = 'gallery'`

### Step 3: Upload Documents (Optional)
**Component**: `DocumentUploader.js`

**Supported Documents**:
- Title Deed
- Ownership Certificate
- Property Survey
- Building Permit
- Other documents

**Features**:
- Single document upload
- Document name input
- Document type selection
- Automatic access key generation
- File size validation (max 10MB)

**Output**: Documents stored in `property_documents` table with unique access keys

### Step 4: Preview & Submit
**Component**: `PropertyCreationWizard.js` (preview section)

**Shows**:
- All property details
- Uploaded images with thumbnails
- Uploaded documents list
- Image count and document count

**Actions**:
- Review all information
- Go back to edit any step
- Submit property for admin approval

**Output**: Property submitted with `status: 'pending'` for admin verification

## Integration with OwnerDashboard

### Current Implementation

The `OwnerDashboardEnhanced.js` already has the property creation flow. To use the new wizard:

```javascript
// In OwnerDashboardEnhanced.js
import PropertyCreationWizard from './PropertyCreationWizard';

// In the render section:
{showAddProperty && (
  <PropertyCreationWizard
    user={user}
    onComplete={() => {
      setShowAddProperty(false);
      fetchOwnerData();
      alert('🎉 Property submitted successfully!');
    }}
    onCancel={() => setShowAddProperty(false)}
  />
)}
```

### Button to Open Wizard

```javascript
<button
  className="btn-primary"
  onClick={() => setShowAddProperty(true)}
>
  ➕ Add Property
</button>
```

## Database Schema

### property_images Table
```sql
CREATE TABLE property_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  image_url LONGTEXT NOT NULL,        -- Base64 encoded
  image_type ENUM('main', 'gallery', 'document') DEFAULT 'gallery',
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### property_documents Table
```sql
CREATE TABLE property_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_url LONGTEXT NOT NULL,     -- Base64 encoded
  document_type VARCHAR(100),
  access_key VARCHAR(50),
  is_locked BOOLEAN DEFAULT 0,
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
```

## API Endpoints

### Create Property
```
POST /api/properties
Body: {
  title, type, listing_type, price, location, latitude, longitude,
  bedrooms, bathrooms, area, description, owner_id, status, ...
}
Response: { id, message }
```

### Upload Image
```
POST /api/property-images
Body: {
  property_id, image_url (base64), image_type, uploaded_by
}
Response: { id, message }
```

### Get Property Images
```
GET /api/property-images/property/:propertyId
Response: [{ id, property_id, image_url, image_type, created_at }]
```

### Upload Document
```
POST /api/property-documents
Body: {
  property_id, document_name, document_url (base64), document_type, uploaded_by
}
Response: { id, access_key, message }
```

### Get Property Documents
```
GET /api/property-documents/property/:propertyId
Response: [{ id, property_id, document_name, document_type, access_key, ... }]
```

## User Experience Flow

### For Property Owners

1. **Click "Add Property"** button in dashboard
2. **Fill Property Details**
   - Enter all required information
   - Click "Next: Upload Images"
3. **Upload Images**
   - Drag images or click to select
   - Arrange images (set main if needed)
   - Click "Upload X Images"
   - Wait for completion
4. **Upload Documents** (optional)
   - Upload title deed, certificates, etc.
   - Click "Next: Preview"
5. **Review & Submit**
   - Check all details
   - Review images and documents
   - Click "Submit Property"
6. **Confirmation**
   - Property submitted for admin approval
   - Owner can view in "My Properties" with "pending" status

### For Buyers/Viewers

1. **Browse Properties**
   - See property listings with main image
   - View image count indicator
2. **Click Property**
   - Open property details
   - See all information
3. **View 3D Gallery**
   - Click "View Gallery" or property image
   - See all images in 3D viewer
   - Mouse-controlled rotation
   - Zoom with mouse wheel
   - Navigate with buttons or thumbnails

## Styling & Theming

### Color Scheme
- Primary: `#667eea` to `#764ba2` (gradient)
- Secondary: `#e2e8f0`
- Success: `#10b981`
- Warning: `#f59e0b`
- Error: `#ef4444`

### Responsive Design
- Desktop: Full 4-column form grid
- Tablet: 2-column form grid
- Mobile: 1-column form grid

## Error Handling

### Validation Errors
- Empty title → "Please enter a property title"
- Invalid price → "Please enter a price"
- Invalid coordinates → "Latitude/Longitude out of range"

### Upload Errors
- Network error → Retry mechanism
- File too large → Size validation
- Invalid file type → Format validation

### Recovery
- Users can go back to previous steps
- Unsaved changes warning
- Property details saved even if upload fails

## Performance Optimization

### Image Handling
- Base64 encoding for storage
- LONGTEXT column for large data
- Lazy loading in gallery
- Progress tracking for uploads

### Database
- Indexes on property_id
- Foreign key constraints
- Cascade delete for cleanup

## Security Considerations

### Access Control
- Only property owner can upload images/documents
- Admin approval required before listing goes live
- Document access keys for secure sharing

### Data Validation
- File type validation
- File size limits
- SQL injection prevention
- XSS protection

## Testing Checklist

- [ ] Create property with all fields
- [ ] Create property with minimal fields
- [ ] Upload single image
- [ ] Upload multiple images
- [ ] Set main image
- [ ] Remove image before upload
- [ ] Upload document
- [ ] Preview all details
- [ ] Submit property
- [ ] Verify in database
- [ ] Test on mobile
- [ ] Test error scenarios
- [ ] Test network failures

## Future Enhancements

- [ ] Image cropping/editing
- [ ] Batch image optimization
- [ ] Image reordering
- [ ] Image descriptions/captions
- [ ] 360° panoramic images
- [ ] Video tour support
- [ ] AI image quality scoring
- [ ] Automatic image enhancement
- [ ] Bulk property import
- [ ] Property templates

## Troubleshooting

### Images not uploading?
1. Check file size
2. Verify image format
3. Check browser console
4. Verify internet connection
5. Try different browser

### Images not showing in gallery?
1. Refresh page
2. Check if property is approved
3. Verify images uploaded successfully
4. Check browser console for CORS errors

### Main image not changing?
1. Click ⭐ button on desired image
2. Refresh page
3. Check database for image_type

## Support & Documentation

- See `MULTI_IMAGE_UPLOAD_GUIDE.md` for image upload details
- See `PROPERTY_MAP_GUIDE.md` for location features
- Check API documentation for endpoint details
- Review database schema for data structure

## Files Modified/Created

### New Files
- `PropertyCreationWizard.js` - Main wizard component
- `PropertyCreationWizard.css` - Wizard styling
- `PROPERTY_CREATION_IMPLEMENTATION.md` - This guide

### Enhanced Files
- `ImageUploader.js` - Added drag-drop, progress tracking
- `ImageUploader.css` - Enhanced styling
- `Property3DViewer.js` - Image gallery viewer
- `Property3DViewer.css` - Gallery styling

### Documentation
- `MULTI_IMAGE_UPLOAD_GUIDE.md` - Image upload guide
- `PROPERTY_MAP_GUIDE.md` - Map integration guide

## Version History

- v1.0 - Initial implementation with 4-step wizard
- v1.1 - Added drag-drop support
- v1.2 - Added progress tracking
- v1.3 - Added set-main-image feature

## Contact & Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Check server logs
4. Contact system administrator
