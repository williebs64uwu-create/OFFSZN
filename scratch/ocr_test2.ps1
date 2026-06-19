try {
    # Load the assemblies
    [void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime")
    
    # Define paths
    $imagePath = "C:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images\image8.png"
    
    # Get WinRT types
    $ocrEngineType = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]
    $storageFileType = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
    $fileAccessModeType = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
    $bitmapDecoderType = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType=WindowsRuntime]
    
    # Create OCR engine
    $OcrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $OcrEngine) {
        Write-Error "Could not create OCR Engine."
        exit 1
    }
    
    # Get File
    $asyncOp1 = [Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)
    $task1 = [System.WindowsRuntimeSystemExtensions]::AsTask($asyncOp1)
    $file = $task1.GetAwaiter().GetResult()
    
    # Open Stream
    $asyncOp2 = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $task2 = [System.WindowsRuntimeSystemExtensions]::AsTask($asyncOp2)
    $stream = $task2.GetAwaiter().GetResult()
    
    # Decode
    $asyncOp3 = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    $task3 = [System.WindowsRuntimeSystemExtensions]::AsTask($asyncOp3)
    $decoder = $task3.GetAwaiter().GetResult()
    
    $asyncOp4 = $decoder.GetSoftwareBitmapAsync()
    $task4 = [System.WindowsRuntimeSystemExtensions]::AsTask($asyncOp4)
    $bitmap = $task4.GetAwaiter().GetResult()
    
    # Recognize
    $asyncOp5 = $OcrEngine.RecognizeAsync($bitmap)
    $task5 = [System.WindowsRuntimeSystemExtensions]::AsTask($asyncOp5)
    $result = $task5.GetAwaiter().GetResult()
    
    Write-Host "OCR_SUCCESS"
    Write-Host $result.Text
} catch {
    Write-Error $_
}
