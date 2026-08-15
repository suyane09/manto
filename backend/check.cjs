const initSqlJs = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync('./data/arsenal.sqlite');
  const db = new SQL.Database(filebuffer);

  function inspecionar(tabela) {
    console.log('\n===', tabela, '===');
    try {
      const res = db.exec(`SELECT * FROM ${tabela} LIMIT 3`);
      if (!res[0]) { console.log('(vazia)'); return; }
      const cols = res[0].columns;
      for (const row of res[0].values) {
        row.forEach((valor, i) => {
          if (typeof valor === 'string') {
            console.log(cols[i], '->', valor, '| hex:', Buffer.from(valor, 'utf8').toString('hex').slice(0, 60));
          }
        });
        console.log('---');
      }
    } catch (e) {
      console.log('Erro:', e.message);
    }
  }

  inspecionar('orders');
  inspecionar('customers');
})();
