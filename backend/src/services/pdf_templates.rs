/// HTML templates used by Gotenberg to render the header and footer that appear
/// on every page of generated PDF reports.
///
/// Gotenberg injects the current page number and total page count into the
/// `.pageNumber` and `.totalPages` spans respectively. The header and footer are
/// rendered inside the top/bottom page margins configured in the convert request
/// (0.5in each), so the templates must stay compact enough to fit.
pub const PDF_HEADER_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  .wrap { width: 100%; padding: 0 16px; }
  .bar {
    display: flex; align-items: center; justify-content: space-between;
    height: 22px; background: linear-gradient(90deg, #0f3b73 0%, #1d4ed8 60%, #2563eb 100%);
    border-radius: 4px 4px 0 0; padding: 0 12px;
  }
  .brand { display: flex; align-items: center; gap: 7px; color: #ffffff; font-weight: 800; letter-spacing: 1.2px; font-size: 9px; text-transform: uppercase; }
  .brand .dot { width: 8px; height: 8px; border-radius: 50%; background: #60a5fa; box-shadow: 0 0 0 2px rgba(96,165,250,.35); }
  .doc { color: rgba(255,255,255,.92); font-size: 7.5px; letter-spacing: 0.4px; font-weight: 600; text-transform: uppercase; }
  .rule { height: 2.5px; background: linear-gradient(90deg, #2563eb, #93c5fd 55%, #64748b); }
</style>
</head>
<body>
  <div class="wrap">
    <div class="bar">
      <span class="brand"><span class="dot"></span>CoopData</span>
      <span class="doc">Financial &amp; Compliance Assessment Report</span>
    </div>
    <div class="rule"></div>
  </div>
</body>
</html>"#;

pub const PDF_FOOTER_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  .wrap { width: 100%; padding: 0 16px; }
  .rule { height: 3px; background: linear-gradient(90deg, #64748b, #2563eb 45%, #93c5fd); border-radius: 2px; }
  .row {
    display: flex; align-items: center; justify-content: space-between;
    background: #0f172a; border-radius: 0 0 5px 5px; padding: 4px 12px;
  }
  .brand { color: #ffffff; font-size: 9.5px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
  .brand span { color: #60a5fa; }
  .sub { color: #94a3b8; font-size: 7px; letter-spacing: 0.2px; margin-top: 1px; }
  .right { display: flex; align-items: center; gap: 14px; }
  .conf { color: #fecaca; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 6.5px; border: 1px solid rgba(254,202,202,.4); padding: 0 5px; border-radius: 3px; }
  .page { color: #e2e8f0; font-size: 8px; font-weight: 600; }
  .page .pageNumber { color: #ffffff; font-weight: 800; }
  .page .totalPages { color: #60a5fa; font-weight: 800; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="rule"></div>
    <div class="row">
      <div>
        <div class="brand">COOP<span>DATA</span> REPORT</div>
        <div class="sub">Unified Cooperative Financial Intelligence &amp; Compliance</div>
      </div>
      <div class="right">
        <span class="conf">Confidential</span>
        <span class="page">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    </div>
  </div>
</body>
</html>"#;
