
document.addEventListener('DOMContentLoaded', () => {
  const questions = document.querySelectorAll('.faq-item .question');
  questions.forEach(q => {
    q.addEventListener('click', () => {
      questions.forEach(item => {
        if(item !== q) item.parentElement.classList.remove('active');
      });
      q.parentElement.classList.toggle('active');
    });
  });
});


