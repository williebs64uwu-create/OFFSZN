/**
 * OFFSZN Hero Simulation Engine
 * Handles the interactive "Try & Sign Up" flow.
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    const idleState = dropZone.querySelector('.dz-idle');
    const processingState = dropZone.querySelector('.dz-processing');
    const successState = dropZone.querySelector('.dz-success');
    const statusText = document.getElementById('simulation-status');
    const videoMockup = document.getElementById('simulation-video-result');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            startSimulation();
        }
    }

    // Start the simulated process
    function startSimulation() {
        // Switch to processing state
        idleState.style.display = 'none';
        processingState.style.display = 'block';
        successState.style.display = 'none';

        const steps = [
            { text: "Analizando Audio y Portada...", duration: 1.2 },
            { text: "Procesando portada...", duration: 1.0 },
            { text: "Generando Visualizer...", duration: 1.5 },
            { text: "Sincronizando track...", duration: 0.8 }
        ];

        let currentStep = 0;

        function runStep() {
            if (currentStep < steps.length) {
                statusText.innerText = steps[currentStep].text;
                
                // Optional: GSAP pulse effect on status
                if (window.gsap) {
                    gsap.fromTo(statusText, { opacity: 0.5 }, { opacity: 1, duration: 0.5 });
                }

                setTimeout(() => {
                    currentStep++;
                    runStep();
                }, steps[currentStep].duration * 1000);
            } else {
                showSuccess();
            }
        }

        runStep();
    }

    function showSuccess() {
        processingState.style.display = 'none';
        successState.style.display = 'block';

        // Animate the video mockup on the right
        if (videoMockup) {
            videoMockup.classList.add('active');
            if (window.gsap) {
                gsap.to(videoMockup, { 
                    scale: 1.02, 
                    duration: 0.5, 
                    yoyo: true, 
                    repeat: 1,
                    ease: "power2.out"
                });
            }
        }

        // Trigger the auth modal after a short delay
        setTimeout(() => {
            if (window.showGuestModal) {
                window.showGuestModal(
                    "¡Video Creado con Éxito!", 
                    "Tu visualizer está listo para YouTube. Crea una cuenta gratuita para exportarlo y subirlo automáticamente."
                );
            }
            
            // Reset after some time if they close modal? 
            // Or just leave it in success state.
        }, 1200);
    }
});
