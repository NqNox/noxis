const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.feature-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.querySelector(`[data-feature="${tab.dataset.target}"]`).classList.add('active');
    });
});