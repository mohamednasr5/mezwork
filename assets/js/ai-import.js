/* ===================================
   MezoMenu SaaS - AI Import Functions
   استيراد القائمة بالذكاء الاصطناعي
   Supports: Worker AI + NVIDIA API
   =================================== */

// ==========================================
// AI Import State
// ==========================================
const AIImportState = {
    selectedFile: null,
    imageUrl: '',
    extractedData: null,
    isProcessing: false,
    progress: 0,
    selectedAIProvider: 'worker', // 'worker' or 'nvidia'
    nvidiaModel: 'nvidia/neva-22b' // Default NVIDIA model for vision
};

// ==========================================
// Initialize AI Import Page
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initUploadZones();
    loadImportHistory();
    initAIProviderSelector();
    checkNVIDIAStatus();
});

// ==========================================
// AI Provider Selection
// ==========================================
function initAIProviderSelector() {
    const providerSelect = document.getElementById('aiProviderSelect');
    
    if (providerSelect) {
        providerSelect.addEventListener('change', (e) => {
            AIImportState.selectedAIProvider = e.target.value;
            
            // Show/hide NVIDIA settings based on selection
            const nvidiaSettings = document.getElementById('nvidiaSettings');
            if (nvidiaSettings) {
                nvidiaSettings.style.display = e.target.value === 'nvidia' ? 'block' : 'none';
            }
            
            // Update UI indication
            showNotification('info', `تم اختيار: ${e.target.value === 'worker' ? 'Worker AI (افتراضي)' : 'NVIDIA AI'}`);
        });
    }

    // NVIDIA API Key input handler
    const nvidiaKeyInput = document.getElementById('nvidiaApiKeyInput');
    if (nvidiaKeyInput) {
        nvidiaKeyInput.addEventListener('change', (e) => {
            if (e.target.value.trim()) {
                CONFIG.NVIDIA_API_KEY = e.target.value.trim();
                localStorage.setItem('nvidiaApiKey', e.target.value.trim());
                showNotification('success', 'تم حفظ مفتاح NVIDIA API');
                checkNVIDIAStatus();
            }
        });
        
        // Restore saved key
        const savedKey = localStorage.getItem('nvidiaApiKey');
        if (savedKey) {
            nvidiaKeyInput.value = savedKey;
            CONFIG.NVIDIA_API_KEY = savedKey;
        }
    }

    // Model selector
    const modelSelect = document.getElementById('nvidiaModelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            AIImportState.nvidiaModel = e.target.value;
        });
    }
}

// ==========================================
// Check NVIDIA API Status
// ==========================================
async function checkNVIDIAStatus() {
    const statusEl = document.getElementById('nvidiaStatus');
    if (!statusEl || !CONFIG.NVIDIA_API_KEY) return;

    try {
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
        statusEl.className = 'status-badge status-info';

        // Test NVIDIA API with a simple request
        const testResult = await NVIDIA_AI.chat([{ role: 'user', content: 'Hello, respond with "OK"' }], 'meta/llama3-70b-instruct');
        
        if (testResult && testResult.includes('OK')) {
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> متصل';
            statusEl.className = 'status-badge status-success';
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        statusEl.innerHTML = '<i class="fas fa-times-circle"></i> غير متصل';
        statusEl.className = 'status-badge status-danger';
        console.warn('[NVIDIA] API not available:', error.message);
    }
}

// ==========================================
// Upload Zone Initialization
// ==========================================
function initUploadZones() {
    // Image Upload Zone
    const imageUploadZone = document.getElementById('imageUploadZone');
    const imageInput = document.getElementById('imageInput');

    if (imageUploadZone && imageInput) {
        imageUploadZone.addEventListener('click', () => imageInput.click());
        
        imageUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadZone.classList.add('dragover');
        });

        imageUploadZone.addEventListener('dragleave', () => {
            imageUploadZone.classList.remove('dragover');
        });

        imageUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                handleImageFile(files[0]);
            }
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        });
    }

    // PDF Upload Zone
    const pdfUploadZone = document.getElementById('pdfUploadZone');
    const pdfInput = document.getElementById('pdfInput');

    if (pdfUploadZone && pdfInput) {
        pdfUploadZone.addEventListener('click', () => pdfInput.click());
        
        pdfUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            pdfUploadZone.classList.add('dragover');
        });

        pdfUploadZone.addEventListener('dragleave', () => {
            pdfUploadZone.classList.remove('dragover');
        });

        pdfUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfUploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                handlePDFFile(files[0]);
            }
        });

        pdfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handlePDFFile(e.target.files[0]);
            }
        });
    }
}

// ==========================================
// Handle Image File
// ==========================================
function handleImageFile(file) {
    AIImportState.selectedFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        AIImportState.imageUrl = e.target.result;
        analyzeImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

// ==========================================
// Handle PDF File
// ==========================================
function handlePDFFile(file) {
    AIImportState.selectedFile = file;
    
    // For PDF, we'll upload first then analyze
    showProcessingStatus();
    simulateProgress(30);
    
    uploadFileForAnalysis(file)
        .then(result => {
            simulateProgress(60);
            return analyzeFromUrl(result.url);
        })
        .catch(error => {
            hideProcessingStatus();
            showNotification('error', 'حدث خطأ أثناء رفع الملف: ' + error.message);
        });
}

// ==========================================
// Analyze from URL
// ==========================================
async function analyzeFromUrl() {
    const urlInput = document.getElementById('imageUrlInput');
    const url = urlInput.value.trim();

    if (!url) {
        showNotification('warning', 'الرجاء إدخال رابط الصورة');
        return;
    }

    if (!isValidUrl(url)) {
        showNotification('error', 'الرجاء إدخال رابط صحيح');
        return;
    }

    showProcessingStatus();
    simulateProgress(20);

    try {
        // Call AI Analysis API
        const response = await fetch(`${CONFIG.API_URL}/api/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: url })
        });

        const data = await response.json();

        if (data.success) {
            simulateProgress(100);
            setTimeout(() => {
                hideProcessingStatus();
                displayExtractedData(data.data, url);
                saveToImportHistory(url, data.data);
            }, 500);
        } else {
            throw new Error(data.error || 'فشل التحليل');
        }
    } catch (error) {
        hideProcessingStatus();
        showNotification('error', 'حدث خطأ: ' + error.message);
    }
}

// ==========================================
// Analyze Image - Supports Worker + NVIDIA
// ==========================================
async function analyzeImage(imageData) {
    showProcessingStatus();
    simulateProgress(10);

    try {
        let analysisResult;

        if (AIImportState.selectedAIProvider === 'nvidia' && CONFIG.NVIDIA_API_KEY) {
            // Use NVIDIA AI for analysis
            console.log('[AI Import] Using NVIDIA AI for image analysis...');
            analysisResult = await analyzeWithNVIDIA(imageData);
        } else {
            // Use default Worker AI
            console.log('[AI Import] Using Worker AI for image analysis...');
            analysisResult = await analyzeWithWorker(imageData);
        }

        if (analysisResult.success) {
            simulateProgress(100);
            setTimeout(() => {
                hideProcessingStatus();
                displayExtractedData(analysisResult.data, analysisResult.imageUrl || AIImportState.imageUrl);
                saveToImportHistory(analysisResult.imageUrl || AIImportState.imageUrl, analysisResult.data);
                
                // Log which provider was used
                console.log(`[AI Import] Analysis completed using: ${AIImportState.selectedAIProvider}`);
            }, 500);
        } else {
            throw new Error(analysisResult.error || 'فشل تحليل الصورة');
        }
    } catch (error) {
        hideProcessingStatus();
        
        // If primary provider fails, try fallback
        if (AIImportState.selectedAIProvider === 'nvidia') {
            showNotification('warning', 'فشل NVIDIA AI، جاري المحاولة بالـ Worker...');
            AIImportState.selectedAIProvider = 'worker';
            
            // Retry with Worker
            try {
                const fallbackResult = await analyzeWithWorker(imageData);
                if (fallbackResult.success) {
                    hideProcessingStatus();
                    displayExtractedData(fallbackResult.data, fallbackResult.imageUrl || AIImportState.imageUrl);
                    saveToImportHistory(fallbackResult.imageUrl || AIImportState.imageUrl, fallbackResult.data);
                    showNotification('success', 'تم التحليل باستخدام Worker AI (احتياطي)');
                    return;
                }
            } catch (fallbackError) {
                console.error('[AI Import] Fallback also failed:', fallbackError);
            }
        }
        
        showNotification('error', 'حدث خطأ: ' + error.message);
    }
}

// ==========================================
// Analyze with Worker AI (Default)
// ==========================================
async function analyzeWithWorker(imageData) {
    simulateProgress(30);

    // First upload the image
    const formData = new FormData();
    
    if (AIImportState.selectedFile) {
        formData.append('file', AIImportState.selectedFile);
    }

    simulateProgress(30);

    // Upload to R2 via Worker
    const uploadResponse = await fetch(`${CONFIG.API_URL}/api/upload`, {
        method: 'POST',
        body: formData
    });

    const uploadResult = await uploadResponse.json();

    if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'فشل رفع الصورة');
    }

    simulateProgress(50);

    // Now analyze with AI via Worker
    const analysisResponse = await fetch(`${CONFIG.API_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            imageUrl: uploadResult.url,
            type: 'menu'
        })
    });

    const analysisData = await analysisResponse.json();

    if (analysisData.success) {
        return {
            success: true,
            data: analysisData.data,
            imageUrl: uploadResult.url,
            provider: 'worker'
        };
    } else {
        throw new Error(analysisData.error || 'فشل تحليل الصورة');
    }
}

// ==========================================
// Analyze with NVIDIA AI (Alternative)
// ==========================================
async function analyzeWithNVIDIA(imageData) {
    simulateProgress(20);

    if (!CONFIG.NVIDIA_API_KEY) {
        throw new Error('مفتاح NVIDIA API غير مضبوط. أدخل المفتاح في الإعدادات.');
    }

    try {
        simulateProgress(40);

        // Use NVIDIA's vision model for menu analysis
        const prompt = `أنت خبير في تحليل قوائم المطاعم. قم بتحليل هذه الصورة واستخرج:
1. أسماء الفئات (Categories)
2. الأصناف في كل فئة مع الأسعار
3. وصف مختصر لكل صنف

قم بتنسيق النتيجة كـ JSON بهذه البنية:
{
  "categories": [
    {
      "name": "اسم الفئة",
      "items": [
        {
          "name": "اسم الصنف",
          "price": السعر كرقم,
          "description": "وصف مختصر"
        }
      ]
    }
  ],
  "confidence": نسبة الثقة من 0 إلى 100
}

الصورة هي لقائمة مطعم باللغة العربية. استخرج النصوص والأسعار بدقة.`;

        const nvidiaResponse = await NVIDIA_AI.analyzeImage(imageData, prompt);
        
        simulateProgress(70);

        if (!nvidiaResponse) {
            throw new Error('لم يستجيب NVIDIA AI');
        }

        // Parse the response to extract JSON
        let parsedData;
        try {
            // Try to extract JSON from the response
            const jsonMatch = nvidiaResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.warn('[NVIDIA] Failed to parse JSON, using raw response:', parseError);
            
            // Fallback: create a basic structure from the text
            parsedData = {
                categories: [{
                    name: 'قائمة مستوردة',
                    items: [{
                        name: 'قائمة محددة بالذكاء الاصطناعي',
                        price: 0,
                        description: nvidiaResponse.substring(0, 200) + '...'
                    }]
                }],
                confidence: 75,
                rawText: nvidiaResponse
            };
        }

        simulateProgress(100);

        return {
            success: true,
            data: parsedData,
            imageData: imageData,
            provider: 'nvidia'
        };

    } catch (error) {
        console.error('[NVIDIA Analysis] Error:', error);
        throw new Error(`خطأ في NVIDIA AI: ${error.message}`);
    }
}

// ==========================================
// Display Extracted Data
// ==========================================
function displayExtractedData(data, imageUrl) {
    AIImportState.extractedData = data;

    const previewContainer = document.getElementById('previewContainer');
    const originalImagePreview = document.getElementById('originalImagePreview');
    const extractedCategories = document.getElementById('extractedCategories');
    const totalCategories = document.getElementById('totalCategories');
    const totalItems = document.getElementById('totalItems');
    const confidenceScore = document.getElementById('confidenceScore');

    // Show original image
    if (originalImagePreview) {
        originalImagePreview.src = imageUrl;
    }

    // Show extracted categories and items
    if (extractedCategories && data.categories) {
        extractedCategories.innerHTML = '';
        
        data.categories.forEach((category, index) => {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'extracted-category';
            categoryEl.innerHTML = `
                <h4><i class="fas fa-folder"></i> ${category.name}</h4>
                <div class="extracted-items">
                    ${category.items.map(item => `
                        <div class="extracted-item">
                            <span class="item-name">${item.name}</span>
                            <span class="item-price">${formatCurrency(item.price)}</span>
                            ${item.description ? `<small class="item-desc">${item.description}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
            extractedCategories.appendChild(categoryEl);
        });

        // Update stats
        totalCategories.textContent = data.categories.length;
        totalItems.textContent = data.categories.reduce((sum, cat) => sum + cat.items.length, 0);
        confidenceScore.textContent = (data.confidence || 95) + '%';
    }

    // Show preview container
    previewContainer.style.display = 'block';

    // Scroll to preview
    previewContainer.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// Save Extracted Data
// ==========================================
async function saveExtractedData() {
    if (!AIImportState.extractedData) {
        showNotification('warning', 'لا توجد بيانات للحفظ');
        return;
    }

    try {
        showLoading('جاري حفظ البيانات...');

        const restaurantId = AppState.restaurant?.id || getRestaurantIdFromStorage();
        
        const response = await fetch(`${CONFIG.API_URL}/api/menu/import`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                restaurantId: restaurantId,
                categories: AIImportState.extractedData.categories,
                source: 'ai-import'
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('success', 'تم حفظ القائمة بنجاح! تم استيراد ' + getTotalItemsCount() + ' صنف');
            
            // Redirect to menu page after short delay
            setTimeout(() => {
                window.location.href = 'menu.html';
            }, 1500);
        } else {
            throw new Error(result.error || 'فشل الحفظ');
        }
    } catch (error) {
        hideLoading();
        showNotification('error', 'حدث خطأ أثناء الحفظ: ' + error.message);
    }
}

// ==========================================
// Edit Extracted Data
// ==========================================
function editExtractedData() {
    // Open edit modal or redirect to menu editor with pre-filled data
    sessionStorage.setItem('importedMenuData', JSON.stringify(AIImportState.extractedData));
    window.location.href = 'menu.html?mode=edit&source=import';
}

// ==========================================
// Reset Import
// ==========================================
function resetImport() {
    AIImportState.selectedFile = null;
    AIImportState.imageUrl = '';
    AIImportState.extractedData = null;

    document.getElementById('previewContainer').style.display = 'none';
    document.getElementById('processingStatus').style.display = 'none';
    document.getElementById('imageUrlInput').value = '';
    document.getElementById('analysisProgress').style.width = '0%';
    
    // Reset file inputs
    document.getElementById('imageInput').value = '';
    document.getElementById('pdfInput').value = '';
}

// ==========================================
// UI Helper Functions
// ==========================================
function showProcessingStatus() {
    const statusEl = document.getElementById('processingStatus');
    if (statusEl) {
        statusEl.style.display = 'block';
    }
    AIImportState.isProcessing = true;
}

function hideProcessingStatus() {
    const statusEl = document.getElementById('processingStatus');
    if (statusEl) {
        statusEl.style.display = 'none';
    }
    AIImportState.isProcessing = false;
    AIImportState.progress = 0;
}

function simulateProgress(targetProgress) {
    const progressBar = document.getElementById('analysisProgress');
    let current = AIImportState.progress;
    
    const interval = setInterval(() => {
        current += Math.random() * 10;
        if (current >= targetProgress) {
            current = targetProgress;
            clearInterval(interval);
        }
        if (progressBar) {
            progressBar.style.width = current + '%';
        }
        AIImportState.progress = current;
    }, 200);
}

function getTotalItemsCount() {
    if (!AIImportState.extractedData?.categories) return 0;
    return AIImportState.extractedData.categories.reduce((sum, cat) => sum + cat.items.length, 0);
}

// ==========================================
// Import History
// ==========================================
function saveToImportHistory(url, data) {
    const history = JSON.parse(localStorage.getItem('aiImportHistory') || '[]');
    history.unshift({
        id: generateId(),
        timestamp: new Date().toISOString(),
        url: url,
        itemCount: data.categories?.reduce((sum, cat) => sum + cat.items.length, 0) || 0,
        status: 'success'
    });
    
    // Keep only last 20 imports
    localStorage.setItem('aiImportHistory', JSON.stringify(history.slice(0, 20)));
    renderImportHistory(history);
}

function loadImportHistory() {
    const history = JSON.parse(localStorage.getItem('aiImportHistory') || '[]');
    renderImportHistory(history);
}

function renderImportHistory(history) {
    const container = document.getElementById('importHistoryList');
    if (!container) return;

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد استيرادات سابقة</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-icon">
                <i class="fas fa-${item.status === 'success' ? 'check-circle text-success' : 'exclamation-circle text-danger'}"></i>
            </div>
            <div class="history-info">
                <span>${item.itemCount} صنف مستورد</span>
                <small>${formatDateTime(item.timestamp)}</small>
            </div>
            <span class="history-status ${item.status}">${item.status === 'success' ? 'نجح' : 'فشل'}</span>
        </div>
    `).join('');
}

// ==========================================
// Utility Functions
// ==========================================
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function uploadFileForAnalysis(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${CONFIG.API_URL}/api/upload`, {
        method: 'POST',
        body: formData
    });

    return await response.json();
}
