# 📄 PDF Utility App - Complete PDF Toolkit

A beautiful, modern web application that provides a complete suite of PDF tools - all directly in your browser. No uploads required - everything runs client-side for maximum privacy and speed!

## ✨ Features

### ✍️ Sign PDF
Add signatures, text, and dates to your PDF documents:
- **Draw Signatures**: Use mouse or touch to draw your signature
- **Save & Reuse**: Save signatures for quick reuse
- **Add Text**: Insert custom text annotations
- **Add Dates**: Insert formatted dates
- **Multi-Page Support**: Sign across multiple pages
- **Drag & Reposition**: Move signatures and text after placement
- **Visual Editor**: See changes in real-time

### 📸 Images to PDF
Convert your images to a professional PDF document:
- **Multiple Image Support**: Add as many images as you want
- **Customizable Page Size**: A4, Letter, or Fit to Image
- **Smart Orientation**: Auto, Portrait, or Landscape
- **Drag & Drop Interface**: Easy file management
- **Supports**: JPG, PNG, GIF, WebP

### 📑 Merge PDFs
Combine multiple PDF files into one document:
- **Unlimited PDFs**: Merge as many PDFs as needed
- **Maintains Quality**: Original formatting preserved
- **Order Control**: Files merged in display order
- **Progress Tracking**: See merge progress

### 🖼️ PDF to Images
Extract PDF pages as individual image files:
- **Multiple Formats**: PNG (high quality) or JPEG (smaller size)
- **Quality Control**: Adjustable JPEG quality (50-100%)
- **Batch Export**: All pages exported as ZIP archive
- **High Resolution**: 2x scale for crisp images

### ✂️ Split PDF
Split a PDF into multiple files:
- **Three Split Modes**:
  - All Pages (individual files)
  - Page Ranges (e.g., 1-3, 5-7)
  - Every N Pages (e.g., every 2 pages)
- **ZIP Download**: All split files in one archive
- **Flexible Options**: Customize how you split

### 🔄 Rotate PDF
Rotate pages in your PDF document:
- **Multiple Angles**: 90°, 180°, or 270° rotation
- **Selective Rotation**: Rotate all or selected pages
- **Visual Page Selection**: See thumbnails before rotating
- **Preview**: Click to select/deselect pages

### 📋 Extract Pages
Extract specific pages from a PDF:
- **Page Selection**: Visual thumbnail selection
- **Multi-Select**: Choose multiple pages
- **Order Preserved**: Pages extracted in order
- **New PDF**: Creates a new document with selected pages

### 🔒 Universal Features
- **100% Private**: All operations run in your browser
- **No Upload**: Files never leave your device
- **Offline Ready**: Works without internet (after first load)
- **Fast Processing**: Instant results
- **Modern UI**: Beautiful, intuitive interface
- **Responsive Design**: Works on all devices
- **No Installation**: Just open and use

## 🚀 Getting Started

### Quick Start

1. **Open the app**: Simply open `index.html` in your web browser
2. **Choose a mode**: Click one of the six mode buttons
3. **Add files**: Drag & drop or browse for files
4. **Configure**: Adjust settings as needed
5. **Process**: Click the action button to process

### Using a Local Server (Optional)

For the best experience, especially with PDF.js features:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js
npx http-server -p 8000
```

Then open: `http://localhost:8000`

## 📖 Detailed Usage Guide

### ✍️ Sign PDF

1. Click "✍️ Sign PDF"
2. Add a PDF file to sign
3. Use the signature tools on the left:
   - **Draw Signature**: Draw with mouse/touch, customize color and size
   - **Add Text**: Type text and customize font size and color
   - **Add Date**: Choose date format
4. Click "Save Signature" or "Add to PDF"
5. Click on the PDF preview to place your signature/text/date
6. Navigate through pages using Previous/Next buttons
7. Drag placed items to reposition them
8. Hover and click × to remove items
9. Click "Save Signed PDF" when done

**Tips:**
- Draw signatures smoothly for best results
- Save frequently-used signatures for quick reuse
- Text and dates can be customized with different colors and sizes
- You can sign multiple pages in the same document
- All signatures are embedded permanently in the PDF

### 📸 Images to PDF

1. Click "📸 Images → PDF"
2. Add images (drag & drop or browse)
3. Customize:
   - **PDF Name**: Enter output filename
   - **Page Size**: Choose A4, Letter, or Fit to Image
   - **Orientation**: Auto, Portrait, or Landscape
4. Click "Convert to PDF"
5. PDF downloads automatically

**Tips:**
- Auto orientation chooses landscape for wide images, portrait for tall
- Fit to Image creates pages that match image dimensions
- Images maintain aspect ratio (no distortion)

### 📑 Merge PDFs

1. Click "📑 Merge PDFs"
2. Add 2 or more PDF files
3. Files are merged in display order
4. Optionally name your merged PDF
5. Click "Merge PDFs"
6. Download your merged file

**Tips:**
- Add PDFs in the order you want them merged
- Remove any PDF by clicking the × button
- All page sizes and orientations are preserved

### 🖼️ PDF → Images

1. Click "🖼️ PDF → Images"
2. Add a single PDF file
3. View PDF information (pages, size)
4. Choose:
   - **Format**: PNG (better quality) or JPEG (smaller)
   - **Quality**: Adjust JPEG quality slider (50-100)
5. Click "Convert to Images"
6. Download ZIP file with all images

**Tips:**
- PNG is lossless but creates larger files
- JPEG at 92 quality offers good balance
- High resolution (2x scale) for crisp images

### ✂️ Split PDF

1. Click "✂️ Split PDF"
2. Add a single PDF file
3. Choose split mode:
   - **All Pages**: Each page becomes separate PDF
   - **Range**: Specify ranges like "1-3,5-7"
   - **Every N**: Split every N pages (e.g., 2)
4. Enter options based on mode
5. Click "Split PDF"
6. Download ZIP with all split files

**Tips:**
- Range example: "1-3,5-7" creates 2 PDFs
- Every N example: 2 creates PDFs with 2 pages each
- All files are named sequentially

### 🔄 Rotate PDF

1. Click "🔄 Rotate PDF"
2. Add a single PDF file
3. View page thumbnails
4. Select rotation angle (90°, 180°, 270°)
5. Choose apply to:
   - **All Pages**: Rotates entire document
   - **Selected Pages**: Click thumbnails to select
6. Click "Rotate PDF"
7. Download rotated PDF

**Tips:**
- Click page thumbnails to select/deselect
- Selected pages show checkmark
- 90° is clockwise, 270° is counter-clockwise

### 📋 Extract Pages

1. Click "📋 Extract Pages"
2. Add a single PDF file
3. View page thumbnails
4. Either:
   - Select "All Pages", or
   - Click thumbnails to select specific pages
5. Click "Extract Pages"
6. Download new PDF with selected pages

**Tips:**
- Selected pages appear in order in new PDF
- Click thumbnails to toggle selection
- Useful for removing unwanted pages

## 🛠️ Technologies Used

- **HTML5**: Modern semantic markup
- **CSS3**: Grid, Flexbox, animations, gradients
- **JavaScript (ES6+)**: Async/await, modules, modern syntax
- **jsPDF**: PDF generation from images
- **pdf-lib**: PDF manipulation (merge, split, rotate, extract)
- **PDF.js**: PDF rendering and page extraction
- **JSZip**: Creating ZIP archives (loaded dynamically)

## 📦 Dependencies

All libraries are loaded from CDN - no installation needed!

```html
<!-- PDF Generation -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

<!-- PDF Manipulation -->
<script src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>

<!-- PDF Rendering -->
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>

<!-- JSZip (loaded dynamically when needed) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

## 🌟 Key Advantages

### Privacy First
All processing happens entirely in your browser using JavaScript. Your files never leave your device, ensuring complete privacy and security.

### No Server Required
This is a static web application - no backend, no database, no account needed. Just open and use!

### Comprehensive Toolkit
Six powerful tools in one app - everything you need for PDF management.

### Modern UX
- Intuitive mode switching
- Visual feedback and animations
- Responsive layout
- Clear instructions

### Production Ready
- Error handling
- Loading states
- Input validation
- Browser compatibility

## 🎨 Customization

### Changing Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --primary-color: #6366f1;
    --primary-hover: #4f46e5;
    --success-color: #10b981;
    --danger-color: #ef4444;
    /* ... more colors */
}
```

### Adding Features

The code is modular and well-documented:
- **Mode configs**: Edit `modeConfigs` in `script.js`
- **Actions**: Add new action functions
- **UI**: Modify HTML structure in `index.html`

## 🐛 Troubleshooting

**Files not loading?**
- Check file format compatibility
- Ensure files aren't corrupted
- Try a different browser

**PDF operations failing?**
- Verify PDF isn't password-protected
- Check if PDF is corrupted
- Try a simpler PDF first

**Images not rendering?**
- Ensure images are valid formats
- Check file size (very large files may be slow)
- Try reducing image resolution

**Page looks broken?**
- Ensure all files are in same folder
- Check internet connection (for CDN libraries)
- Clear browser cache and reload

**Thumbnails not showing?**
- PDF.js requires server (use local server)
- Check browser console for errors
- Ensure PDF.js worker loaded correctly

## 📱 Browser Compatibility

Tested and working on:
- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ✅ Opera (v76+)

**Note**: Some features (like PDF rendering) work best with a local server.

## 🔐 Security & Privacy

- ✅ No data collection
- ✅ No analytics or tracking
- ✅ No external API calls (except CDN for libraries)
- ✅ All processing client-side
- ✅ Files never uploaded
- ✅ No cookies or local storage (except for caching)

## 💡 Use Cases

### Personal
- Sign documents without printing
- Create photo albums from vacation pictures
- Merge scanned documents
- Extract pages from manuals
- Rotate incorrectly oriented scans
- Convert screenshots to PDF
- Add signatures to forms

### Professional
- Electronically sign contracts and agreements
- Add approval signatures to documents
- Sign NDAs and legal documents
- Combine contracts and agreements
- Split large PDFs for email
- Extract specific pages from reports
- Rotate and fix document orientation
- Create presentations from images
- Sign invoices and receipts

### Student
- Sign permission slips
- Add name and date to assignments
- Combine lecture notes
- Create study guides from images
- Split textbook chapters
- Extract exam pages
- Organize research papers

## 🚧 Future Enhancements

Potential features to add:
- [ ] Password protect PDFs
- [ ] Remove password from PDFs
- [ ] Add watermarks (text/image)
- [ ] Compress PDFs
- [ ] Edit PDF metadata
- [ ] Add page numbers
- [ ] Reorder pages (drag & drop)
- [ ] Crop PDF pages
- [ ] Add bookmarks
- [ ] Convert PDF to other formats
- [ ] OCR (text recognition)
- [x] ~~Digital signatures~~ **✅ DONE!**
- [ ] Form filling
- [ ] Dark mode
- [ ] Batch processing multiple files
- [ ] Cloud storage integration (optional)

## 📊 Performance Tips

1. **Large PDFs**: May take time to process - be patient
2. **Many Images**: Convert in batches for faster processing
3. **High Resolution**: Balance quality vs file size
4. **Browser**: Use modern browser for best performance
5. **Memory**: Close other tabs if processing large files

## 🤝 Contributing

This is an open-source project! Feel free to:
- Fork and modify
- Submit improvements
- Report bugs
- Suggest features
- Share with others

## 📄 License

This project is open source and available for personal and commercial use.

## 🙏 Credits

Built with love using amazing open-source libraries:
- jsPDF by Parallax
- pdf-lib by Andrew Dillon
- PDF.js by Mozilla
- JSZip by Stuart Knightley

## 📞 Support

Having issues? Check:
1. This README file
2. Browser console for errors
3. File format compatibility
4. Internet connection (for CDN)

---

**Enjoy your complete PDF toolkit!** 🎉

Made with ❤️ for the community • 100% Free • 100% Private • 100% Browser-Based
