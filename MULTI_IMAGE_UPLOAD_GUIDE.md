# Multi-Image Upload Guide for Property Listings

## Overview
Property owners can now upload multiple high-quality images during property listing creation. These images are displayed in a beautiful 3D gallery viewer for potential buyers.

## How It Works

### 1. **Property Creation Flow**
When an owner creates a new property listing, they follow these steps:

```
Step 1: Fill Property Details (form)
   ↓
Step 2: Upload Multiple Images (new enhanced uploader)
   ↓
Step 3: Upload Documents (optional)
   ↓
Step 4: Preview & Submit
```

### 2. **Image Upload Features**

#### Drag & Drop Support
- Drag multiple images directly into the upload area
- Or click to browse and select files
- Supports all common image formats (JPG, PNG, WebP, etc.)

#### Image Management
- **Set Main Image**: Click the ⭐ button to set any image as the main/cover image
- **Remove Image**: Click the ✕ button to remove an image before uploading
- **Preview**: See all selected images before uploading
- **Progress Tracking**: Visual progress bar for each image upload

#### Recommended Best Practices
- Upload 5-10 high-quality images per property
- First image becomes the main/cover image (shown in listings)
- Include: exterior, living room, bedrooms, kitchen, bathrooms, garden/parking
- Use high-resolution images (1920x1080 or higher)
- Ensure good lighting and clear angles

### 3. **Image Storage**

Images are stored as:
- **Format**: Base64 encoded data URLs
- **Database**: `property_images` table with LONGTEXT column
- **Types**: 
  - `main` - Cover image shown in property listings
  - `gallery` - Additional images shown in 3D viewer

### 4. **Buyer Experience**

When buyers view a property:

1. **Property Listing Page**
   - See the main image as property thumbnail
   - Image count indicator (e.g., "5 images")

2. **3D Gallery Viewer**
   - Click property to open full 3D gallery
   - Features:
     - Mouse-controlled 3D perspective rotation
     - Zoom in/out with mouse wheel
     - Navigate between images with prev/next buttons
     - Click thumbnails to jump to specific images
     - View property details alongside images

### 5. **API Endpoints**

#### Upload Image
```
POST /api/property-images
Body: {
  property_id: number,
  image_url: string (base64 data URL),
  image_type: 'main' | 'gallery',
  uploaded_by: number (user ID)
}
Response: { id, message }
```

#### Get Property Images
```
GET /api/property-images/property/:propertyId
Response: [
  {
    id: number,
    property_id: number,
    image_url: string,
    image_type: string,
    created_at: timestamp
  }
]
```

#### Delete Image
```
DELETE /api/property-images/:id
Response: { message }
```

### 6. **Database Schema**

```sql
CREATE TABLE property_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  image_url LONGTEXT NOT NULL,        -- Base64 encoded image
  image_type ENUM('main', 'gallery', 'document') DEFAULT 'gallery',
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 7. **Component Structure**

#### ImageUploader Component
**Location**: `client/src/components/shared/ImageUploader.js`

**Props**:
- `propertyId` (number) - ID of the property
- `uploadedBy` (number) - User ID uploading images
- `onUploadComplete` (function) - Callback when upload finishes

**Features**:
- Drag & drop file selection
- Multiple file selection
- Image preview grid
- Set main image functionality
- Upload progress tracking
- Error handling

#### Property3DViewer Component
**Location**: `client/src/components/Property3DViewer.js`

**Props**:
- `property` (object) - Property data
- `onClose` (function) - Close viewer callback

**Features**:
- Display all property images
- 3D perspective rotation on mouse move
- Zoom with mouse wheel
- Image navigation
- Thumbnail gallery
- Property details panel

### 8. **Implementation Checklist**

For property owners:
- [ ] Fill in property details (title, price, location, etc.)
- [ ] Upload 5-10 high-quality images
- [ ] Set the best image as main/cover
- [ ] Upload property documents (optional)
- [ ] Review property preview
- [ ] Submit for admin approval

For admins:
- [ ] Verify property details
- [ ] Check image quality
- [ ] Approve or reject listing
- [ ] Publish to active listings

### 9. **Troubleshooting**

**Images not uploading?**
- Check file size (should be reasonable)
- Ensure images are in supported format
- Check browser console for errors
- Verify internet connection

**Images not showing in gallery?**
- Refresh the page
- Check if property is approved
- Verify images were uploaded successfully
- Check browser console for CORS errors

**Main image not changing?**
- Click the ⭐ button on desired image
- Refresh page to see changes
- Check if image is marked as 'main' type

### 10. **Performance Tips**

- Compress images before uploading (use tools like TinyPNG)
- Optimal image size: 1-3 MB per image
- Use modern formats (WebP) when possible
- Avoid uploading more than 20 images per property
- Clear browser cache if images don't update

### 11. **Security Considerations**

- Images are stored as base64 in database
- Access controlled through property ownership
- Only property owner can upload/delete images
- Images are associated with property ID
- Automatic cleanup when property is deleted

## Example Usage

### For Property Owners

1. Go to Owner Dashboard
2. Click "Add New Property"
3. Fill in property details
4. Click "Next: Upload Images"
5. Drag images or click to select
6. Arrange images (set main image if needed)
7. Click "Upload X Images"
8. Wait for upload to complete
9. Click "Next: Documents" or "Preview"
10. Submit property for approval

### For Developers

```javascript
// Using ImageUploader component
<ImageUploader 
  propertyId={propertyId}
  uploadedBy={userId}
  onUploadComplete={() => {
    console.log('Images uploaded!');
    // Move to next step
  }}
/>

// Using Property3DViewer component
<Property3DViewer 
  property={propertyData}
  onClose={() => setShowViewer(false)}
/>
```

## Future Enhancements

- [ ] Image cropping/editing before upload
- [ ] Batch image optimization
- [ ] Image ordering/reordering
- [ ] Image descriptions/captions
- [ ] 360° panoramic image support
- [ ] Video tour support
- [ ] AI-powered image quality scoring
- [ ] Automatic image enhancement

## Support

For issues or questions:
1. Check browser console for errors
2. Review this guide
3. Contact system administrator
4. Check server logs for API errors
