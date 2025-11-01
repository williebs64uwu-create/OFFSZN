document.addEventListener("DOMContentLoaded", function() {
  // Inicializa EmailJS
  emailjs.init("If_WAVcuXiGSPp2SB");

  const form = document.getElementById("contactForm");

  form.addEventListener("submit", function(event) {
    event.preventDefault();

     
      .then(() => {
        alert("Mensaje enviado correctamente!");
        form.reset();
      })
      .catch((error) => {
        console.error("Error al enviar el mensaje:", error);
        alert("Ocurrió un error al enviar el mensaje.");
      });
  });
});
