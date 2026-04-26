# Visual Guide - Property Listing System

## 🎬 User Journey

### Property Owner Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    OWNER DASHBOARD                          │
│                                                             │
│  [➕ Add Property] [📄 Requests] [🤝 Agreements]           │
│                                                             │
│  📋 My Properties                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Image │ Title      │ Type │ Price │ Location │ Status │  │
│  │ 🏠   │ Modern Villa│ Villa│ 5M    │ Kezira   │ ⏳    │  │
│  │ 🏠   │ Apartment   │ Apt  │ 2M    │ Bole     │ ✅    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    Click "Add Property"
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: PROPERTY DETAILS                       │
│                                                             │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                             │
│  Property Title *        [Modern Villa in Kezira]          │
│  Property Type *         [Apartment ▼]                     │
│  Listing Type *          [For Sale ▼]                      │
│  Price (ETB) *           [5000000]                         │
│  Location *              [Kezira, Addis Ababa]            │
│  Bedrooms                [3]                               │
│  Bathrooms               [2]                               │
│  Area (m²)               [250]                             │
│  Description             [Beautiful modern villa...]       │
│  Latitude                [9.0320]                          │
│  Longitude               [38.7469]                         │
│  Condition               [Good ▼]                          │
│  Security Rating         [High ▼]                          │
│  Distance to Center      [3]                               │
│  ☑ Near School  ☑ Near Hospital  ☑ Parking               │
│                                                             │
│  [Cancel]                          [Next: Upload Images →] │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: UPLOAD IMAGES                          │
│                                                             │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                             │
│  📸 Click to select images or drag & drop                  │
│  Recommended: 5-10 high-quality images                     │
│                                                             │
│  Selected Images (5)                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ [Image] │ │ [Image] │ │ [Image] │ │ [Image] │         │
│  │ Main    │ │ ⭐      │ │ ✕       │ │ ✕       │         │
│  │ Image   │ │ Set Main│ │ Remove  │ │ Remove  │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│  ┌─────────┐                                               │
│  │ [Image] │                                               │
│  │ ✕       │                                               │
│  │ Remove  │                                               │
│  └─────────┘                                               │
│                                                             │
│  [← Back]                          [📤 Upload 5 Images →] │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: UPLOAD DOCUMENTS                       │
│                                                             │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                             │
│  📄 Upload property documents (optional)                   │
│  Title deed, ownership certificate, etc.                   │
│                                                             │
│  Document Name: [Title Deed]                              │
│  Document Type: [Title Deed ▼]                            │
│  [Choose File] deed.pdf                                    │
│                                                             │
│  [← Back]                          [Next: Preview →]       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              STEP 4: PREVIEW & SUBMIT                       │
│                                                             │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                             │
│  Property Details          │  Images (5)                   │
│  ─────────────────────────┼──────────────────────          │
│  Title: Modern Villa       │  ┌─────┐ ┌─────┐ ┌─────┐    │
│  Type: Villa               │  │ [1] │ │ [2] │ │ [3] │    │
│  Price: 5M ETB             │  └─────┘ └─────┘ └─────┘    │
│  Location: Kezira          │  ┌─────┐ ┌─────┐            │
│  Bedrooms: 3               │  │ [4] │ │ [5] │            │
│  Bathrooms: 2              │  └─────┘ └─────┘            │
│  Area: 250 m²              │                               │
│  Condition: Good           │  Documents (1)                │
│  Security: High            │  📄 Title Deed                │
│                            │                               │
│  [← Back]                          [✅ Submit Property]    │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    Property Submitted!
                    Waiting for Admin Approval
```

### Buyer Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    PROPERTY LISTINGS                        │
│                                                             │
│  [Search] [Filter] [Sort]                                  │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ [Main Image]     │  │ [Main Image]     │               │
│  │ 5 images        │  │ 3 images        │               │
│  │ Modern Villa     │  │ Apartment       │               │
│  │ 5M ETB           │  │ 2M ETB          │               │
│  │ Kezira           │  │ Bole            │               │
│  │ [View Gallery]   │  │ [View Gallery]   │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ [Main Image]     │  │ [Main Image]     │               │
│  │ 8 images        │  │ 4 images        │               │
│  │ Luxury House     │  │ Studio          │               │
│  │ 8M ETB           │  │ 1.5M ETB        │               │
│  │ Addis Ababa      │  │ Piazza          │               │
│  │ [View Gallery]   │  │ [View Gallery]   │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    Click "View Gallery"
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              3D PROPERTY GALLERY VIEWER                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                                                     │   │
│  │              [3D Rotating Image]                   │   │
│  │              (Move mouse to rotate)                │   │
│  │              (Scroll to zoom)                      │   │
│  │                                                     │   │
│  │                                                     │   │
│  │                                                     │   │
│  │         [❮] 1 / 5 [❯]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Property Details          Thumbnails                      │
│  ─────────────────────────  ──────────────────────         │
│  Type: Villa                ┌─────┐ ┌─────┐ ┌─────┐      │
│  Bedrooms: 3                │ [1] │ │ [2] │ │ [3] │      │
│  Bathrooms: 2               └─────┘ └─────┘ └─────┘      │
│  Area: 250 m²               ┌─────┐ ┌─────┐              │
│  Price: 5M ETB              │ [4] │ │ [5] │              │
│  Location: Kezira           └─────┘ └─────┘              │
│  Condition: Good                                           │
│  Security: High             [✕ Close]                     │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Component Structure

```
PropertyCreationWizard
├── Modal Overlay
├── Modal Header
│   ├── Title (Step indicator)
│   └── Close Button
├── Progress Bar
│   ├── Step 1 (Form)
│   ├── Step 2 (Images)
│   ├── Step 3 (Documents)
│   └── Step 4 (Preview)
├── Modal Body
│   ├── Step 1: Property Form
│   │   ├── Form Grid
│   │   ├── Input Fields
│   │   └── Checkboxes
│   ├── Step 2: ImageUploader
│   │   ├── Upload Area
│   │   ├── Preview Grid
│   │   └── Upload Button
│   ├── Step 3: DocumentUploader
│   │   ├── File Input
│   │   ├── Document Type
│   │   └── Upload Button
│   └── Step 4: Preview
│       ├── Property Details
│       ├── Images Preview
│       └── Documents List
└── Modal Footer
    ├── Back Button
    └── Next/Submit Button

Property3DViewer
├── Modal Overlay
├── Modal Header
│   ├── Title
│   └── Close Button
├── Viewer Content
│   ├── Canvas Area
│   │   ├── Image Container
│   │   │   └── Image (with 3D transform)
│   │   └── Navigation
│   │       ├── Prev Button
│   │       ├── Counter
│   │       └── Next Button
│   └── Controls Panel
│       ├── Zoom Slider
│       ├── Rotation Display
│       ├── Property Info
│       └── Thumbnails Grid
└── Loading Spinner

ImageUploader
├── Upload Area
│   ├── Icon
│   ├── Text
│   └── File Input
├── Preview Section
│   ├── Title
│   └── Preview Grid
│       └── Preview Items
│           ├── Image
│           ├── Remove Button
│           ├── Set Main Button
│           ├── Main Badge
│           └── Progress Bar
└── Upload Actions
    ├── Upload Button
    └── Clear Button
```

## 📊 Data Flow Diagram

```
┌──────────────────┐
│  Property Owner  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  PropertyCreationWizard              │
│  ├─ Step 1: Property Details         │
│  ├─ Step 2: Upload Images            │
│  ├─ Step 3: Upload Documents         │
│  └─ Step 4: Preview & Submit         │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Backend API                         │
│  ├─ POST /api/properties             │
│  ├─ POST /api/property-images        │
│  └─ POST /api/property-documents     │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Database                            │
│  ├─ properties table                 │
│  ├─ property_images table            │
│  └─ property_documents table         │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Admin Dashboard                     │
│  ├─ Review Properties                │
│  ├─ Approve/Reject                   │
│  └─ Publish to Live                  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Property Listings                   │
│  ├─ Browse Properties                │
│  ├─ View Details                     │
│  └─ View 3D Gallery                  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Property3DViewer                    │
│  ├─ Display Images                   │
│  ├─ 3D Rotation                      │
│  ├─ Zoom Controls                    │
│  └─ Property Details                 │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Buyer/Viewer    │
└──────────────────┘
```

## 🎯 Feature Highlights

### Image Upload Features
```
┌─────────────────────────────────────┐
│  ImageUploader Features             │
├─────────────────────────────────────┤
│ ✅ Drag & Drop                      │
│ ✅ Multiple Selection               │
│ ✅ Real-time Preview                │
│ ✅ Set Main Image                   │
│ ✅ Remove Before Upload             │
│ ✅ Progress Tracking                │
│ ✅ Error Handling                   │
│ ✅ File Validation                  │
└─────────────────────────────────────┘
```

### Gallery Viewer Features
```
┌─────────────────────────────────────┐
│  Property3DViewer Features          │
├─────────────────────────────────────┤
│ ✅ 3D Perspective Rotation          │
│ ✅ Mouse-Controlled                 │
│ ✅ Zoom In/Out                      │
│ ✅ Image Navigation                 │
│ ✅ Thumbnail Grid                   │
│ ✅ Property Details                 │
│ ✅ Responsive Design                │
│ ✅ Smooth Animations                │
└─────────────────────────────────────┘
```

## 📱 Responsive Breakpoints

```
Desktop (1200px+)
┌─────────────────────────────────────┐
│ Full 4-column form grid             │
│ Side-by-side preview                │
│ Full-size gallery                   │
└─────────────────────────────────────┘

Tablet (768px - 1199px)
┌─────────────────────────────────────┐
│ 2-column form grid                  │
│ Stacked preview                     │
│ Optimized gallery                   │
└─────────────────────────────────────┘

Mobile (< 768px)
┌─────────────────────────────────────┐
│ 1-column form grid                  │
│ Full-width preview                  │
│ Touch-friendly gallery              │
└─────────────────────────────────────┘
```

## 🎨 Color Palette

```
Primary Gradient
┌─────────────────────────────────────┐
│ #667eea ──────────► #764ba2         │
│ (Blue)              (Purple)        │
└─────────────────────────────────────┘

Semantic Colors
┌─────────────────────────────────────┐
│ Success:  #10b981 (Green)           │
│ Warning:  #f59e0b (Amber)           │
│ Error:    #ef4444 (Red)             │
│ Info:     #3b82f6 (Blue)            │
└─────────────────────────────────────┘

Neutral Colors
┌─────────────────────────────────────┐
│ Background: #f8fafc (Light Gray)    │
│ Border:     #e2e8f0 (Gray)          │
│ Text:       #2d3748 (Dark Gray)     │
│ Muted:      #718096 (Medium Gray)   │
└─────────────────────────────────────┘
```

## 🔄 State Transitions

```
Property Creation States
┌─────────────────────────────────────┐
│ Initial                             │
│ └─► Form (Step 1)                   │
│     └─► Images (Step 2)             │
│         └─► Documents (Step 3)      │
│             └─► Preview (Step 4)    │
│                 └─► Submitted       │
│                     └─► Pending     │
│                         └─► Approved│
│                             └─► Live│
└─────────────────────────────────────┘

Image Upload States
┌─────────────────────────────────────┐
│ Idle                                │
│ └─► Selecting                       │
│     └─► Previewing                  │
│         └─► Uploading               │
│             └─► Complete            │
│                 └─► Success/Error   │
└─────────────────────────────────────┘
```

## 📈 Performance Metrics

```
Load Times
┌─────────────────────────────────────┐
│ Form Load:        < 500ms           │
│ Image Upload:     2-5s per image    │
│ Gallery Load:     < 1s              │
│ 3D Rotation:      60 FPS            │
│ Database Query:   < 100ms           │
└─────────────────────────────────────┘

File Sizes
┌─────────────────────────────────────┐
│ Component JS:     ~50KB             │
│ Component CSS:    ~15KB             │
│ Image (avg):      1-3MB             │
│ Document (max):   10MB              │
└─────────────────────────────────────┘
```

---

This visual guide helps understand the complete property listing system flow and architecture!
