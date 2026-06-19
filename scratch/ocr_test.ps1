try {
    # Ensure Windows Runtime assembly is loaded
    $assembly = [System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime")
    
    # Load Windows.Media.Ocr types
    $ocrEngineType = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]
    $storageFileType = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
    $fileAccessModeType = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
    $bitmapDecoderType = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType=WindowsRuntime]
    
    $OcrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $OcrEngine) {
        Write-Error "OCR Engine could not be created from user profile languages. Trying default..."
        $OcrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() # Fallback or standard
    }
    
    if (-not $OcrEngine) {
        Write-Error "Could not initialize OCR engine."
        exit 1
    }
    
    $imagePath = "C:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images\image8.png"
    if (-not (Test-Path $imagePath)) {
        Write-Error "File not found: $imagePath"
        exit 1
    }
    
    # Open storage file and stream
    $asyncOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)
    # Block and wait for results
    while ($asyncOp.Status -eq 'Started') { Start-Sleep -Milliseconds 10 }
    $file = $asyncOp.GetResults()
    
    $asyncOp2 = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    while ($asyncOp2.Status -eq 'Started') { Start-Sleep -Milliseconds 10 }
    $stream = $asyncOp2.GetResults()
    
    # Decode
    $asyncOp3 = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    while ($asyncOp3.Status -eq 'Started') { Start-Sleep -Milliseconds 10 }
    $decoder = $asyncOp3.GetResults()
    
    $asyncOp4 = $decoder.GetSoftwareBitmapAsync()
    while ($asyncOp4.Status -eq 'Started') { Start-Sleep -Milliseconds 10 }
    $bitmap = $asyncOp4.GetResults()
    
    # Recognize
    $asyncOp5 = $OcrEngine.RecognizeAsync($bitmap)
    while ($asyncOp5.Status -eq 'Started') { Start-Sleep -Milliseconds 10 }
    $result = $asyncOp5.GetResults()
    
    Write-Host "OCR_SUCCESS"
    Write-Host $result.Text
} catch {
    Write-Error $_
}
