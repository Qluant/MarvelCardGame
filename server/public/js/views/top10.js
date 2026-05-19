async function loadTop10() {
  try {
    const { data } = await Api.get('/players/top');
    const tbody = document.getElementById('top10-tbody');
    tbody.innerHTML = '';
    data.forEach((p, idx) => {
      const avatarImg = p.avatar || '/assets/images/avatar.jpg';
      tbody.innerHTML += `<tr>
        <td>#${idx + 1}</td>
        <td><img src="${avatarImg}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid var(--marvel-red);"></td>
        <td><a href="#" onclick="viewUserProfile('${p.nickname}'); return false;" style="color:var(--marvel-red);font-weight:bold;text-decoration:none;">${p.nickname}</a></td>
        <td>${p.wins}</td><td>${p.loses}</td><td>${p.draws}</td><td>${p.winstreak}</td>
      </tr>`;
    });
  } catch (err) {
    console.error('Failed to load top 10:', err);
  }
}
