// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const filesContainer = document.getElementById('filesContainer');
const controls = document.getElementById('controls');
const actionBtn = document.getElementById('actionBtn');
const clearBtn = document.getElementById('clearBtn');
const fileName = document.getElementById('fileName');
const dropText = document.getElementById('dropText');
const fileInfo = document.getElementById('fileInfo');
const btnText = document.getElementById('btnText');
const modeDescription = document.getElementById('modeDescription');
const pdfInfoDisplay = document.getElementById('pdfInfoDisplay');
const pageSelection = document.getElementById('pageSelection');
const pageGrid = document.getElementById('pageGrid');

// Mode buttons
const modeButtons = {
    imageToPdf: document.getElementById('imageToPdfMode'),
    mergePdf: document.getElementById('mergePdfMode'),
    pdfToImages: document.getElementById('pdfToImagesMode'),
    splitPdf: document.getElementById('splitPdfMode'),
    rotatePdf: document.getElementById('rotatePdfMode'),
    extractPages: document.getElementById('extractPagesMode'),
    signPdf: document.getElementById('signPdfMode')
};

// Control groups
const pageSizeGroup = document.getElementById('pageSizeGroup');
const orientationGroup = document.getElementById('orientationGroup');
const splitModeGroup = document.getElementById('splitModeGroup');
const splitOptionsGroup = document.getElementById('splitOptionsGroup');
const rotationGroup = document.getElementById('rotationGroup');
const applyToGroup = document.getElementById('applyToGroup');
const imageFormatGroup = document.getElementById('imageFormatGroup');
const imageQualityGroup = document.getElementById('imageQualityGroup');

// Other controls
const imageQuality = document.getElementById('imageQuality');
const qualityValue = document.getElementById('qualityValue');

// State
let files = [];
let currentMode = 'imageToPdf';
let currentPdfDoc = null;
let selectedPages = new Set();

// Sign PDF State
let signatureInterface = null;
let signatureCanvas = null;
let signatureCtx = null;
let isDrawing = false;
let savedSignatures = [];
let pdfCanvas = null;
let pdfCtx = null;
let currentPdfPage = 1;
let pdfDocument = null;
let annotations = {};  // {pageNum: [annotations]}
let currentTool = 'draw';
let pendingAnnotation = null;

// Mode configurations
const modeConfigs = {
    imageToPdf: {
        accept: 'image/*',
        multiple: true,
        dropText: 'Drag & drop images here',
        fileInfo: 'Supports JPG, PNG, GIF, WebP',
        buttonText: 'Convert to PDF',
        description: 'Convert your images to a single PDF file with customizable page size and orientation.',
        defaultFileName: 'converted-images'
    },
    mergePdf: {
        accept: 'application/pdf',
        multiple: true,
        dropText: 'Drag & drop PDF files here',
        fileInfo: 'Supports PDF files only',
        buttonText: 'Merge PDFs',
        description: 'Combine multiple PDF files into a single document. Files will be merged in order.',
        defaultFileName: 'merged-document'
    },
    pdfToImages: {
        accept: 'application/pdf',
        multiple: false,
        dropText: 'Drag & drop a PDF file here',
        fileInfo: 'Select a single PDF file',
        buttonText: 'Convert to Images',
        description: 'Extract all pages from a PDF as individual image files.',
        defaultFileName: 'page'
    },
    splitPdf: {
        accept: 'application/pdf',
        multiple: false,
        dropText: 'Drag & drop a PDF file here',
        fileInfo: 'Select a single PDF file',
        buttonText: 'Split PDF',
        description: 'Split a PDF into multiple files based on page ranges or intervals.',
        defaultFileName: 'split'
    },
    rotatePdf: {
        accept: 'application/pdf',
        multiple: false,
        dropText: 'Drag & drop a PDF file here',
        fileInfo: 'Select a single PDF file',
        buttonText: 'Rotate PDF',
        description: 'Rotate pages in your PDF document by 90, 180, or 270 degrees.',
        defaultFileName: 'rotated'
    },
    extractPages: {
        accept: 'application/pdf',
        multiple: false,
        dropText: 'Drag & drop a PDF file here',
        fileInfo: 'Select a single PDF file',
        buttonText: 'Extract Pages',
        description: 'Extract specific pages from your PDF and create a new document.',
        defaultFileName: 'extracted'
    },
    signPdf: {
        accept: 'application/pdf',
        multiple: false,
        dropText: 'Drag & drop a PDF file here',
        fileInfo: 'Select a single PDF file to sign',
        buttonText: 'Save Signed PDF',
        description: 'Add signatures, text, and dates to your PDF document with an easy-to-use interface.',
        defaultFileName: 'signed'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    switchMode('imageToPdf');
});

function setupEventListeners() {
    // Mode switching
    Object.keys(modeButtons).forEach(mode => {
        modeButtons[mode].addEventListener('click', () => switchMode(mode));
    });

    // File input
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // Buttons
    actionBtn.addEventListener('click', handleAction);
    clearBtn.addEventListener('click', clearAll);

    // Image quality slider
    imageQuality.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value;
    });

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
}

function switchMode(mode) {
    currentMode = mode;
    const config = modeConfigs[mode];

    // Update active button
    Object.values(modeButtons).forEach(btn => btn.classList.remove('active'));
    modeButtons[mode].classList.add('active');

    // Update UI
    fileInput.accept = config.accept;
    fileInput.multiple = config.multiple;
    dropText.textContent = config.dropText;
    fileInfo.textContent = config.fileInfo;
    btnText.textContent = config.buttonText;
    modeDescription.textContent = config.description;
    fileName.value = config.defaultFileName;

    // Show/hide mode-specific controls
    hideAllModeControls();
    showModeControls(mode);

    // Clear files
    files = [];
    currentPdfDoc = null;
    selectedPages.clear();
    displayFiles();
    pdfInfoDisplay.classList.remove('visible');
    pageSelection.classList.remove('visible');
}

function hideAllModeControls() {
    document.querySelectorAll('.mode-specific').forEach(el => {
        el.classList.remove('visible');
    });
}

function showModeControls(mode) {
    const controlMap = {
        imageToPdf: ['image-to-pdf'],
        splitPdf: ['split-pdf'],
        rotatePdf: ['rotate-pdf'],
        extractPages: ['extract-pages'],
        pdfToImages: ['pdf-to-images'],
        signPdf: ['sign-pdf']
    };

    const controls = controlMap[mode] || [];
    controls.forEach(className => {
        document.querySelectorAll(`.${className}`).forEach(el => {
            el.classList.add('visible');
        });
    });

    // Show/hide signature interface
    signatureInterface = signatureInterface || document.getElementById('signatureInterface');
    if (mode === 'signPdf') {
        signatureInterface.classList.add('visible');
        if (!signatureCanvas) {
            initializeSignatureTools();
        }
    } else {
        signatureInterface.classList.remove('visible');
    }
}

async function handleFiles(selectedFiles) {
    const fileArray = Array.from(selectedFiles);
    const config = modeConfigs[currentMode];

    if (!config.multiple && fileArray.length > 1) {
        alert('Please select only one file for this mode');
        return;
    }

    if (currentMode === 'imageToPdf') {
        handleImageFiles(fileArray);
    } else {
        handlePdfFiles(fileArray);
    }

    fileInput.value = '';
}

function handleImageFiles(fileArray) {
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        alert('Please select valid image files (JPG, PNG, GIF, WebP)');
        return;
    }

    imageFiles.forEach(file => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                files.push({
                    type: 'image',
                    file: file,
                    dataUrl: e.target.result,
                    name: file.name,
                    width: img.width,
                    height: img.height
                });
                displayFiles();
            };
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
}

async function handlePdfFiles(fileArray) {
    const pdfFiles = fileArray.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
        alert('Please select valid PDF files');
        return;
    }

    if (currentMode === 'mergePdf') {
        // For merge mode, allow multiple PDFs
        pdfFiles.forEach(file => {
            const reader = new FileReader();

            reader.onload = (e) => {
                files.push({
                    type: 'pdf',
                    file: file,
                    arrayBuffer: e.target.result,
                    name: file.name,
                    size: file.size
                });
                displayFiles();
            };

            reader.readAsArrayBuffer(file);
        });
    } else {
        // For single PDF modes, load the PDF document
        const file = pdfFiles[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                files = [{
                    type: 'pdf',
                    file: file,
                    arrayBuffer: e.target.result,
                    name: file.name,
                    size: file.size
                }];

                currentPdfDoc = await PDFLib.PDFDocument.load(e.target.result);
                await displayPdfInfo();
                displayFiles();

                // Show page selection for modes that need it
                if (['rotatePdf', 'extractPages'].includes(currentMode)) {
                    await renderPageThumbnails();
                }

                // Load PDF for signing
                if (currentMode === 'signPdf') {
                    await loadPdfForSigning(e.target.result);
                }
            } catch (error) {
                console.error('Error loading PDF:', error);
                alert('Failed to load PDF. The file may be corrupted or password-protected.');
            }
        };

        reader.readAsArrayBuffer(file);
    }
}

function displayFiles() {
    filesContainer.innerHTML = '';

    if (files.length === 0) {
        controls.classList.remove('visible');
        return;
    }

    controls.classList.add('visible');

    files.forEach((file, index) => {
        if (file.type === 'image') {
            const imageCard = document.createElement('div');
            imageCard.className = 'image-card';

            imageCard.innerHTML = `
                <img src="${file.dataUrl}" alt="${file.name}">
                <button class="remove-btn" data-index="${index}">×</button>
                <div class="image-name" title="${file.name}">${file.name}</div>
            `;

            filesContainer.appendChild(imageCard);
        } else {
            const pdfCard = document.createElement('div');
            pdfCard.className = 'pdf-card';

            pdfCard.innerHTML = `
                <div class="pdf-icon">📄</div>
                ${currentMode === 'mergePdf' ? `<button class="remove-btn" data-index="${index}">×</button>` : ''}
                <div class="pdf-name" title="${file.name}">${file.name}</div>
                <div class="pdf-info">${formatFileSize(file.size)}</div>
            `;

            filesContainer.appendChild(pdfCard);
        }
    });

    // Add remove button listeners
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index);
            removeFile(index);
        });
    });
}

async function displayPdfInfo() {
    if (!currentPdfDoc) return;

    const pageCount = currentPdfDoc.getPageCount();
    const pdfBytes = files[0].arrayBuffer.byteLength;

    pdfInfoDisplay.innerHTML = `
        <h3>📄 PDF Information</h3>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Total Pages</div>
                <div class="info-value">${pageCount}</div>
            </div>
            <div class="info-item">
                <div class="info-label">File Size</div>
                <div class="info-value">${formatFileSize(pdfBytes)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">File Name</div>
                <div class="info-value">${files[0].name}</div>
            </div>
        </div>
    `;
    pdfInfoDisplay.classList.add('visible');
}

async function renderPageThumbnails() {
    if (!currentPdfDoc || typeof pdfjsLib === 'undefined') return;

    pageGrid.innerHTML = '';
    pageSelection.classList.add('visible');

    const loadingTask = pdfjsLib.getDocument({ data: files[0].arrayBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        const pageThumb = document.createElement('div');
        pageThumb.className = 'page-thumb';
        pageThumb.dataset.page = i;

        pageThumb.innerHTML = `
            ${canvas.outerHTML}
            <div class="page-number">Page ${i}</div>
            <div class="checkmark">✓</div>
        `;

        pageThumb.addEventListener('click', () => togglePageSelection(i, pageThumb));
        pageGrid.appendChild(pageThumb);
    }
}

function togglePageSelection(pageNum, element) {
    if (selectedPages.has(pageNum)) {
        selectedPages.delete(pageNum);
        element.classList.remove('selected');
    } else {
        selectedPages.add(pageNum);
        element.classList.add('selected');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function removeFile(index) {
    files.splice(index, 1);
    if (files.length === 0) {
        currentPdfDoc = null;
        selectedPages.clear();
        pdfInfoDisplay.classList.remove('visible');
        pageSelection.classList.remove('visible');
    }
    displayFiles();
}

function clearAll() {
    if (files.length === 0) return;

    if (confirm('Are you sure you want to clear all files?')) {
        files = [];
        currentPdfDoc = null;
        selectedPages.clear();
        pdfInfoDisplay.classList.remove('visible');
        pageSelection.classList.remove('visible');
        displayFiles();
    }
}

async function handleAction() {
    const actions = {
        imageToPdf: convertImagesToPdf,
        mergePdf: mergePdfs,
        pdfToImages: convertPdfToImages,
        splitPdf: splitPdf,
        rotatePdf: rotatePdf,
        extractPages: extractPages,
        signPdf: saveSignedPdf
    };

    const action = actions[currentMode];
    if (action) {
        await action();
    }
}

// === ACTION IMPLEMENTATIONS ===

async function convertImagesToPdf() {
    if (files.length === 0) {
        alert('Please add some images first!');
        return;
    }

    setLoading(true);

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const pageSize = document.getElementById('pageSize').value;
        const orientation = document.getElementById('orientation').value;
        let isFirstPage = true;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            let pageOrientation = orientation;
            if (orientation === 'auto') {
                pageOrientation = file.width > file.height ? 'landscape' : 'portrait';
            }

            if (!isFirstPage) pdf.addPage();
            isFirstPage = false;

            if (pageOrientation === 'landscape') {
                pdf.internal.pageSize.width = pdf.internal.pageSize.height;
                pdf.internal.pageSize.height = pdf.internal.pageSize.width;
            }

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            let imgWidth, imgHeight, x, y;

            if (pageSize === 'fit') {
                const imgAspectRatio = file.width / file.height;
                pdf.internal.pageSize.width = 210;
                pdf.internal.pageSize.height = 210 / imgAspectRatio;
                imgWidth = pdf.internal.pageSize.width;
                imgHeight = pdf.internal.pageSize.height;
                x = 0;
                y = 0;
            } else {
                const imgAspectRatio = file.width / file.height;
                const pageAspectRatio = pageWidth / pageHeight;

                if (imgAspectRatio > pageAspectRatio) {
                    imgWidth = pageWidth - 20;
                    imgHeight = imgWidth / imgAspectRatio;
                } else {
                    imgHeight = pageHeight - 20;
                    imgWidth = imgHeight * imgAspectRatio;
                }

                x = (pageWidth - imgWidth) / 2;
                y = (pageHeight - imgHeight) / 2;
            }

            pdf.addImage(file.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
        }

        const outputName = fileName.value.trim() || 'converted-images';
        pdf.save(`${outputName}.pdf`);

        alert(`✅ PDF created successfully! File saved as "${outputName}.pdf"`);
    } catch (error) {
        console.error('Error converting to PDF:', error);
        alert('❌ An error occurred while converting to PDF. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function mergePdfs() {
    if (files.length < 2) {
        alert('Please add at least 2 PDF files to merge!');
        return;
    }

    setLoading(true);

    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const pdfDoc = await PDFDocument.load(file.arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const outputName = fileName.value.trim() || 'merged-document';
        downloadFile(mergedPdfBytes, `${outputName}.pdf`, 'application/pdf');

        alert(`✅ PDFs merged successfully! File saved as "${outputName}.pdf"`);
    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('❌ An error occurred while merging PDFs. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function convertPdfToImages() {
    if (!currentPdfDoc || typeof pdfjsLib === 'undefined') {
        alert('Please add a PDF file first!');
        return;
    }

    setLoading(true);

    try {
        const loadingTask = pdfjsLib.getDocument({ data: files[0].arrayBuffer });
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        const format = document.getElementById('imageFormat').value;
        const quality = parseInt(document.getElementById('imageQuality').value) / 100;

        const JSZip = window.JSZip ? window.JSZip : await loadJSZip();
        const zip = new JSZip();

        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const scale = 2.0;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', quality);
            });

            const baseName = fileName.value.trim() || 'page';
            zip.file(`${baseName}_${i}.${format}`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const outputName = fileName.value.trim() || 'pdf-images';
        downloadFile(zipBlob, `${outputName}.zip`);

        alert(`✅ Converted ${pageCount} pages to images! Download the ZIP file.`);
    } catch (error) {
        console.error('Error converting PDF to images:', error);
        alert('❌ An error occurred. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function splitPdf() {
    if (!currentPdfDoc) {
        alert('Please add a PDF file first!');
        return;
    }

    setLoading(true);

    try {
        const { PDFDocument } = PDFLib;
        const splitMode = document.getElementById('splitMode').value;
        const splitOptions = document.getElementById('splitOptions').value;
        const pageCount = currentPdfDoc.getPageCount();
        const JSZip = window.JSZip ? window.JSZip : await loadJSZip();
        const zip = new JSZip();

        if (splitMode === 'all') {
            // Split into individual pages
            for (let i = 0; i < pageCount; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(currentPdfDoc, [i]);
                newPdf.addPage(copiedPage);
                const pdfBytes = await newPdf.save();
                zip.file(`page_${i + 1}.pdf`, pdfBytes);
            }
        } else if (splitMode === 'range' && splitOptions) {
            // Split by ranges (e.g., "1-3,5-7")
            const ranges = parsePageRanges(splitOptions, pageCount);
            for (let i = 0; i < ranges.length; i++) {
                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(currentPdfDoc, ranges[i]);
                copiedPages.forEach(page => newPdf.addPage(page));
                const pdfBytes = await newPdf.save();
                zip.file(`part_${i + 1}.pdf`, pdfBytes);
            }
        } else if (splitMode === 'everyN' && splitOptions) {
            // Split every N pages
            const n = parseInt(splitOptions);
            if (isNaN(n) || n < 1) {
                alert('Please enter a valid number for splitting');
                return;
            }

            let partNum = 1;
            for (let i = 0; i < pageCount; i += n) {
                const newPdf = await PDFDocument.create();
                const endPage = Math.min(i + n, pageCount);
                const pageIndices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
                const copiedPages = await newPdf.copyPages(currentPdfDoc, pageIndices);
                copiedPages.forEach(page => newPdf.addPage(page));
                const pdfBytes = await newPdf.save();
                zip.file(`part_${partNum}.pdf`, pdfBytes);
                partNum++;
            }
        } else {
            alert('Please specify split options');
            return;
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const outputName = fileName.value.trim() || 'split-pdf';
        downloadFile(zipBlob, `${outputName}.zip`);

        alert('✅ PDF split successfully! Download the ZIP file.');
    } catch (error) {
        console.error('Error splitting PDF:', error);
        alert('❌ An error occurred. Please check your options and try again.');
    } finally {
        setLoading(false);
    }
}

async function rotatePdf() {
    if (!currentPdfDoc) {
        alert('Please add a PDF file first!');
        return;
    }

    setLoading(true);

    try {
        const { PDFDocument, degrees } = PDFLib;
        const rotationAngle = parseInt(document.getElementById('rotationAngle').value);
        const applyTo = document.getElementById('applyTo').value;

        const newPdf = await PDFDocument.create();
        const pageCount = currentPdfDoc.getPageCount();
        const pages = currentPdfDoc.getPages();

        for (let i = 0; i < pageCount; i++) {
            const [copiedPage] = await newPdf.copyPages(currentPdfDoc, [i]);

            if (applyTo === 'all' || (applyTo === 'selected' && selectedPages.has(i + 1))) {
                copiedPage.setRotation(degrees(rotationAngle));
            }

            newPdf.addPage(copiedPage);
        }

        const pdfBytes = await newPdf.save();
        const outputName = fileName.value.trim() || 'rotated';
        downloadFile(pdfBytes, `${outputName}.pdf`, 'application/pdf');

        alert('✅ PDF rotated successfully!');
    } catch (error) {
        console.error('Error rotating PDF:', error);
        alert('❌ An error occurred. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function extractPages() {
    if (!currentPdfDoc) {
        alert('Please add a PDF file first!');
        return;
    }

    const applyTo = document.getElementById('applyTo').value;

    if (applyTo === 'selected' && selectedPages.size === 0) {
        alert('Please select at least one page to extract');
        return;
    }

    setLoading(true);

    try {
        const { PDFDocument } = PDFLib;
        const newPdf = await PDFDocument.create();
        const pageCount = currentPdfDoc.getPageCount();

        if (applyTo === 'all') {
            const copiedPages = await newPdf.copyPages(currentPdfDoc, currentPdfDoc.getPageIndices());
            copiedPages.forEach(page => newPdf.addPage(page));
        } else {
            const pagesToExtract = Array.from(selectedPages).sort((a, b) => a - b).map(p => p - 1);
            const copiedPages = await newPdf.copyPages(currentPdfDoc, pagesToExtract);
            copiedPages.forEach(page => newPdf.addPage(page));
        }

        const pdfBytes = await newPdf.save();
        const outputName = fileName.value.trim() || 'extracted';
        downloadFile(pdfBytes, `${outputName}.pdf`, 'application/pdf');

        alert('✅ Pages extracted successfully!');
    } catch (error) {
        console.error('Error extracting pages:', error);
        alert('❌ An error occurred. Please try again.');
    } finally {
        setLoading(false);
    }
}

// === UTILITY FUNCTIONS ===

function parsePageRanges(rangeString, maxPages) {
    const ranges = [];
    const parts = rangeString.split(',');

    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= maxPages && start <= end) {
                ranges.push(Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i));
            }
        } else {
            const page = parseInt(part);
            if (!isNaN(page) && page >= 1 && page <= maxPages) {
                ranges.push([page - 1]);
            }
        }
    });

    return ranges;
}

function downloadFile(data, filename, mimeType = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setLoading(isLoading) {
    actionBtn.disabled = isLoading;
    if (isLoading) {
        btnText.innerHTML = '<span class="loading"></span> Processing...';
    } else {
        btnText.textContent = modeConfigs[currentMode].buttonText;
    }
}

async function loadJSZip() {
    // Load JSZip dynamically if needed
    if (window.JSZip) return window.JSZip;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ===== SIGN PDF FUNCTIONALITY =====

function initializeSignatureTools() {
    // Get signature elements
    signatureCanvas = document.getElementById('signatureCanvas');
    signatureCtx = signatureCanvas.getContext('2d');
    pdfCanvas = document.getElementById('pdfCanvas');
    pdfCtx = pdfCanvas.getContext('2d');

    const clearCanvasBtn = document.getElementById('clearCanvasBtn');
    const saveSignatureBtn = document.getElementById('saveSignatureBtn');
    const signatureColor = document.getElementById('signatureColor');
    const signatureSize = document.getElementById('signatureSize');
    const sizeValue = document.getElementById('sizeValue');
    
    const drawSignatureBtn = document.getElementById('drawSignatureBtn');
    const addTextBtn = document.getElementById('addTextBtn');
    const addDateBtn = document.getElementById('addDateBtn');
    
    const textInput = document.getElementById('textInput');
    const addTextToCanvasBtn = document.getElementById('addTextToCanvasBtn');
    const addDateToCanvasBtn = document.getElementById('addDateToCanvasBtn');
    const dateFormat = document.getElementById('dateFormat');
    const datePreview = document.getElementById('datePreview');
    
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const canvasWrapper = document.getElementById('canvasWrapper');

    // Signature drawing
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);

    // Touch support
    signatureCanvas.addEventListener('touchstart', handleTouch);
    signatureCanvas.addEventListener('touchmove', handleTouch);
    signatureCanvas.addEventListener('touchend', stopDrawing);

    clearCanvasBtn.addEventListener('click', clearSignatureCanvas);
    saveSignatureBtn.addEventListener('click', saveSignature);
    
    signatureSize.addEventListener('input', (e) => {
        sizeValue.textContent = e.target.value;
    });

    // Tool switching
    drawSignatureBtn.addEventListener('click', () => switchTool('draw'));
    addTextBtn.addEventListener('click', () => switchTool('text'));
    addDateBtn.addEventListener('click', () => switchTool('date'));

    // Add annotations
    addTextToCanvasBtn.addEventListener('click', addTextAnnotation);
    addDateToCanvasBtn.addEventListener('click', addDateAnnotation);

    // Date format change
    dateFormat.addEventListener('change', updateDatePreview);
    updateDatePreview();

    // Page navigation
    prevPageBtn.addEventListener('click', () => navigatePage(-1));
    nextPageBtn.addEventListener('click', () => navigatePage(1));

    // Click on PDF to place annotation
    canvasWrapper.addEventListener('click', handlePdfClick);
}

function switchTool(tool) {
    currentTool = tool;
    
    // Update active button
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const toolButtons = {
        draw: 'drawSignatureBtn',
        text: 'addTextBtn',
        date: 'addDateBtn'
    };
    document.getElementById(toolButtons[tool]).classList.add('active');

    // Show/hide tool panels
    document.getElementById('signatureCreator').style.display = tool === 'draw' ? 'block' : 'none';
    document.getElementById('textCreator').style.display = tool === 'text' ? 'block' : 'none';
    document.getElementById('dateCreator').style.display = tool === 'date' ? 'block' : 'none';
}

function startDrawing(e) {
    isDrawing = true;
    const rect = signatureCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    signatureCtx.beginPath();
    signatureCtx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = signatureCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const color = document.getElementById('signatureColor').value;
    const size = document.getElementById('signatureSize').value;
    
    signatureCtx.strokeStyle = color;
    signatureCtx.lineWidth = size;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signatureCanvas.dispatchEvent(mouseEvent);
}

function clearSignatureCanvas() {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

function saveSignature() {
    const dataUrl = signatureCanvas.toDataURL();
    
    // Check if canvas is empty
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = signatureCanvas.width;
    tempCanvas.height = signatureCanvas.height;
    if (dataUrl === tempCanvas.toDataURL()) {
        alert('Please draw a signature first!');
        return;
    }
    
    savedSignatures.push(dataUrl);
    displaySavedSignatures();
    clearSignatureCanvas();
    alert('Signature saved! Click on the PDF to place it.');
    
    // Set pending annotation
    pendingAnnotation = {
        type: 'signature',
        data: dataUrl,
        width: 150,
        height: 50
    };
}

function displaySavedSignatures() {
    const container = document.getElementById('savedSignatures');
    container.innerHTML = '<h4>Saved Signatures</h4>';
    
    savedSignatures.forEach((sig, index) => {
        const item = document.createElement('div');
        item.className = 'saved-signature-item';
        item.innerHTML = `
            <img src="${sig}" alt="Signature ${index + 1}">
            <button class="remove-signature" data-index="${index}">×</button>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-signature')) {
                pendingAnnotation = {
                    type: 'signature',
                    data: sig,
                    width: 150,
                    height: 50
                };
                alert('Click on the PDF to place this signature');
            }
        });
        
        container.appendChild(item);
    });
    
    // Add remove listeners
    container.querySelectorAll('.remove-signature').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index);
            savedSignatures.splice(index, 1);
            displaySavedSignatures();
        });
    });
}

function addTextAnnotation() {
    const text = document.getElementById('textInput').value.trim();
    if (!text) {
        alert('Please enter some text');
        return;
    }
    
    const fontSize = parseInt(document.getElementById('fontSize').value);
    const color = document.getElementById('textColor').value;
    
    pendingAnnotation = {
        type: 'text',
        data: text,
        fontSize: fontSize,
        color: color
    };
    
    alert('Click on the PDF to place this text');
}

function addDateAnnotation() {
    const format = document.getElementById('dateFormat').value;
    const dateText = formatDate(new Date(), format);
    
    pendingAnnotation = {
        type: 'text',
        data: dateText,
        fontSize: 14,
        color: '#000000'
    };
    
    alert('Click on the PDF to place this date');
}

function updateDatePreview() {
    const format = document.getElementById('dateFormat').value;
    const preview = document.getElementById('datePreview');
    preview.textContent = formatDate(new Date(), format);
}

function formatDate(date, format) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    switch(format) {
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'DD/MM/YYYY':
            return `${day}/${month}/${year}`;
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'full':
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        default:
            return date.toLocaleDateString();
    }
}

async function loadPdfForSigning(arrayBuffer) {
    if (typeof pdfjsLib === 'undefined') {
        alert('PDF.js not loaded. Please refresh the page.');
        return;
    }
    
    try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDocument = await loadingTask.promise;
        currentPdfPage = 1;
        annotations = {};
        
        await renderPdfPage(currentPdfPage);
        updatePageNavigation();
    } catch (error) {
        console.error('Error loading PDF for signing:', error);
        alert('Failed to load PDF for signing');
    }
}

async function renderPdfPage(pageNum) {
    const page = await pdfDocument.getPage(pageNum);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    
    await page.render({ canvasContext: pdfCtx, viewport }).promise;
    
    // Render annotations for this page
    renderAnnotations(pageNum);
}

function renderAnnotations(pageNum) {
    const annotationsLayer = document.getElementById('annotationsLayer');
    annotationsLayer.innerHTML = '';
    
    // Update layer size to match canvas
    annotationsLayer.style.width = pdfCanvas.width + 'px';
    annotationsLayer.style.height = pdfCanvas.height + 'px';
    
    const pageAnnotations = annotations[pageNum] || [];
    
    pageAnnotations.forEach((annotation, index) => {
        const div = document.createElement('div');
        div.className = 'annotation-item';
        div.style.left = annotation.x + 'px';
        div.style.top = annotation.y + 'px';
        div.dataset.index = index;
        
        if (annotation.type === 'signature') {
            const img = document.createElement('img');
            img.src = annotation.data;
            img.style.width = annotation.width + 'px';
            img.style.height = annotation.height + 'px';
            div.appendChild(img);
            div.style.width = annotation.width + 'px';
            div.style.height = annotation.height + 'px';
        } else if (annotation.type === 'text') {
            const span = document.createElement('span');
            span.className = 'annotation-text';
            span.textContent = annotation.data;
            span.style.fontSize = annotation.fontSize + 'px';
            span.style.color = annotation.color;
            span.style.fontWeight = 'bold';
            div.appendChild(span);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-annotation';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeAnnotation(pageNum, index);
        });
        div.appendChild(removeBtn);
        
        // Make draggable
        makeDraggable(div, pageNum, index);
        
        annotationsLayer.appendChild(div);
    });
}

function handlePdfClick(e) {
    if (!pendingAnnotation) return;
    
    const rect = pdfCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Add annotation to current page
    if (!annotations[currentPdfPage]) {
        annotations[currentPdfPage] = [];
    }
    
    const annotation = {
        ...pendingAnnotation,
        x: x,
        y: y
    };
    
    annotations[currentPdfPage].push(annotation);
    pendingAnnotation = null;
    
    renderAnnotations(currentPdfPage);
}

function makeDraggable(element, pageNum, annotationIndex) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('remove-annotation')) return;
        isDragging = true;
        element.classList.add('dragging');
        
        startX = e.clientX;
        startY = e.clientY;
        initialX = parseInt(element.style.left);
        initialY = parseInt(element.style.top);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        element.style.left = (initialX + dx) + 'px';
        element.style.top = (initialY + dy) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.classList.remove('dragging');
            
            // Update annotation position
            annotations[pageNum][annotationIndex].x = parseInt(element.style.left);
            annotations[pageNum][annotationIndex].y = parseInt(element.style.top);
        }
    });
}

function removeAnnotation(pageNum, index) {
    annotations[pageNum].splice(index, 1);
    renderAnnotations(pageNum);
}

async function navigatePage(direction) {
    const newPage = currentPdfPage + direction;
    if (newPage < 1 || newPage > pdfDocument.numPages) return;
    
    currentPdfPage = newPage;
    await renderPdfPage(currentPdfPage);
    updatePageNavigation();
}

function updatePageNavigation() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const indicator = document.getElementById('pageIndicator');
    
    indicator.textContent = `Page ${currentPdfPage} of ${pdfDocument.numPages}`;
    prevBtn.disabled = currentPdfPage === 1;
    nextBtn.disabled = currentPdfPage === pdfDocument.numPages;
}

async function saveSignedPdf() {
    if (!currentPdfDoc || !pdfDocument) {
        alert('Please load a PDF first!');
        return;
    }
    
    if (Object.keys(annotations).length === 0) {
        alert('Please add at least one signature or annotation');
        return;
    }
    
    setLoading(true);
    
    try {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(files[0].arrayBuffer);
        
        // Process each page with annotations
        for (const [pageNum, pageAnnotations] of Object.entries(annotations)) {
            if (pageAnnotations.length === 0) continue;
            
            const pageIndex = parseInt(pageNum) - 1;
            const page = pdfDoc.getPage(pageIndex);
            const { width, height } = page.getSize();
            
            // Calculate scale factor between rendered canvas and actual PDF
            const scale = width / pdfCanvas.width;
            
            for (const annotation of pageAnnotations) {
                if (annotation.type === 'signature') {
                    // Embed signature image
                    const imgData = annotation.data;
                    let image;
                    
                    if (imgData.startsWith('data:image/png')) {
                        image = await pdfDoc.embedPng(imgData);
                    } else {
                        image = await pdfDoc.embedJpg(imgData);
                    }
                    
                    // Convert coordinates (canvas uses top-left, PDF uses bottom-left)
                    const pdfX = annotation.x * scale;
                    const pdfY = height - (annotation.y * scale) - (annotation.height * scale);
                    const pdfWidth = annotation.width * scale;
                    const pdfHeight = annotation.height * scale;
                    
                    page.drawImage(image, {
                        x: pdfX,
                        y: pdfY,
                        width: pdfWidth,
                        height: pdfHeight
                    });
                } else if (annotation.type === 'text') {
                    // Add text
                    const pdfX = annotation.x * scale;
                    const pdfY = height - (annotation.y * scale) - (annotation.fontSize * scale);
                    const fontSize = annotation.fontSize * scale;
                    
                    // Convert hex color to RGB
                    const hex = annotation.color.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16) / 255;
                    const g = parseInt(hex.substr(2, 2), 16) / 255;
                    const b = parseInt(hex.substr(4, 2), 16) / 255;
                    
                    page.drawText(annotation.data, {
                        x: pdfX,
                        y: pdfY,
                        size: fontSize,
                        color: { type: 'RGB', red: r, green: g, blue: b }
                    });
                }
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        const outputName = fileName.value.trim() || 'signed';
        downloadFile(pdfBytes, `${outputName}.pdf`, 'application/pdf');
        
        alert('✅ PDF signed successfully!');
    } catch (error) {
        console.error('Error saving signed PDF:', error);
        alert('❌ An error occurred while saving the signed PDF. Please try again.');
    } finally {
        setLoading(false);
    }
}

