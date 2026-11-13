<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
  xmlns:html="http://www.w3.org/TR/REC-html40"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="ta">
      <head>
        <title>XML Sitemap | கவிஞன் கமலேஷ்</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style type="text/css">
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
            color: #2a2421;
            background: #faf7f2;
            margin: 0;
            padding: 36px 16px;
            line-height: 1.6;
          }
          .container {
            max-width: 960px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            border: 1px solid #eadcd0;
          }
          .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #e6f7ed;
            color: #1a7f37;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 16px;
            border: 1px solid #c2eed0;
          }
          h1 {
            color: #1b365d;
            font-size: 26px;
            margin: 0 0 10px 0;
            font-weight: 700;
          }
          p.desc {
            color: #6e655f;
            font-size: 14.5px;
            margin: 0 0 24px 0;
          }
          .stats {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }
          .stat-box {
            background: #faf4ed;
            border: 1px solid #eedecf;
            padding: 12px 18px;
            border-radius: 10px;
            font-size: 13.5px;
            color: #5a4b41;
          }
          .stat-box strong {
            color: #d96f27;
            font-size: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #ebdcd0;
          }
          th {
            background: #f4eae1;
            color: #1b365d;
            text-align: left;
            padding: 13px 16px;
            font-weight: 600;
            font-size: 13.5px;
            border-bottom: 2px solid #e2cfc0;
          }
          td {
            padding: 13px 16px;
            border-bottom: 1px solid #f2e8df;
            word-break: break-all;
          }
          tr:last-child td {
            border-bottom: none;
          }
          tr:hover td {
            background: #fbf7f4;
          }
          a {
            color: #d96f27;
            text-decoration: none;
            font-weight: 600;
          }
          a:hover {
            text-decoration: underline;
          }
          .tag-priority {
            background: #f0f4f8;
            color: #1b365d;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
          }
          .footer {
            margin-top: 28px;
            padding-top: 18px;
            border-top: 1px solid #eee4dc;
            font-size: 13px;
            color: #8c827a;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-badge">
            <span>●</span> Google Search Console XML Sitemap
          </div>
          <h1>📜 தமிழ் கவிதைகள் — XML Sitemap</h1>
          <p class="desc">
            இந்த Sitemap கோப்பு Google, Bing போன்ற தேடுபொறிகளுக்காக (Search Engines) முழுமையான இணக்கத்துடன் உருவாக்கப்பட்டுள்ளது.
          </p>

          <div class="stats">
            <div class="stat-box">
              பக்கங்களின் எண்ணிக்கை: <strong><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></strong>
            </div>
            <div class="stat-box">
              நிலை: <strong>சரியாக இயங்குகிறது (Active &amp; Valid)</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 55%;">இணைய முகவரி (URL)</th>
                <th style="width: 15%;">முன்னுரிமை (Priority)</th>
                <th style="width: 15%;">அதிர்வெண் (Changefreq)</th>
                <th style="width: 15%;">கடைசி மாற்றம் (Lastmod)</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td>
                    <a href="{sitemap:loc}" target="_blank"><xsl:value-of select="sitemap:loc"/></a>
                  </td>
                  <td><span class="tag-priority"><xsl:value-of select="sitemap:priority"/></span></td>
                  <td><xsl:value-of select="sitemap:changefreq"/></td>
                  <td><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <div class="footer">
            <span>© கவிஞன் கமலேஷ் | Tamil Kavithai</span>
            <span>Googlebot &amp; Bingbot Ready</span>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
