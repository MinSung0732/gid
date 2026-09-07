import { scents, questions, decideScent, messageIndex } from './data.js';
import { shareKakao, shareImage } from './share.js';

const quiz = document.querySelector('#scent-quiz');
const progress = document.querySelector('#quiz-progress');
const question = document.querySelector('#quiz-question');
const options = document.querySelector('#quiz-options');
const backButton = document.querySelector('#quiz-back');
const result = document.querySelector('#daily-result');
const resultImage = document.querySelector('#result-image');
const resultMood = document.querySelector('#result-mood');
const resultName = document.querySelector('#result-name');
const resultMessage = document.querySelector('#result-message');
const status = document.querySelector('#share-status');
const answers = [];
let questionIndex = 0;
let selectedId = '';

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

function renderQuestion() {
  const current = questions[questionIndex];
  progress.textContent = `${questionIndex + 1} / ${questions.length}`;
  progress.style.setProperty('--progress', `${((questionIndex + 1) / questions.length) * 100}%`);
  question.textContent = current.text;
  backButton.hidden = questionIndex === 0;
  options.replaceChildren(...current.options.map((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.option = String(index);
    button.textContent = option.text;
    return button;
  }));
}

function showCard(id) {
  selectedId = id;
  const scent = scents[id];
  const index = messageIndex(id, todayKey());
  result.style.setProperty('--accent', scent.color);
  resultImage.src = scent.image;
  resultImage.alt = `${scent.name} 향을 표현한 이미지`;
  resultMood.textContent = scent.mood;
  resultName.textContent = scent.name;
  resultMessage.textContent = scent.messages[index];
  result.hidden = false;
  quiz.hidden = true;
  status.textContent = '';
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

options.addEventListener('click', event => {
  const button = event.target.closest('[data-option]');
  if (!button) return;
  answers.push(questions[questionIndex].options[Number(button.dataset.option)]);
  questionIndex += 1;
  if (questionIndex < questions.length) renderQuestion();
  else showCard(decideScent(answers));
});

backButton.addEventListener('click', () => {
  if (questionIndex === 0) return;
  answers.pop();
  questionIndex -= 1;
  renderQuestion();
});
document.querySelector('#choose-again').addEventListener('click', () => {
  answers.length = 0;
  questionIndex = 0;
  result.hidden = true;
  quiz.hidden = false;
  renderQuestion();
  quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#kakao-share').addEventListener('click', async () => {
  const scent = scents[selectedId];
  try {
    await shareKakao(selectedId, scent, resultMessage.textContent);
    status.textContent = '카카오톡에서 공유할 대상을 선택해 주세요.';
  } catch (error) {
    status.textContent = '카카오톡 공유를 열지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
});
document.querySelector('#image-share').addEventListener('click', async () => {
  try {
    status.textContent = await shareImage(scents[selectedId], resultMessage.textContent, resultImage);
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? '공유를 취소했어요.' : '공유 이미지를 만들지 못했어요.';
  }
});

renderQuestion();
