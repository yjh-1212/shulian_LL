"""Generate the template library's reviewable PDFs and editable UTF-8 text.

Run with the bundled document runtime. No signed contracts or evidence are made.
"""
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'contract-templates'
LIBRARY = json.loads((ROOT / 'tools/contract-template-library.json').read_text(encoding='utf-8'))
OUTPUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('ContractChinese', 'C:/Windows/Fonts/simsun.ttc', subfontIndex=0))
font = 'ContractChinese'
styles = {
    'title': ParagraphStyle('title', fontName=font, fontSize=20, leading=29, alignment=TA_CENTER, spaceAfter=16),
    'sub': ParagraphStyle('sub', fontName=font, fontSize=10, leading=16, textColor=colors.HexColor('#556070'), spaceAfter=8),
    'heading': ParagraphStyle('heading', fontName=font, fontSize=12, leading=19, spaceBefore=12, spaceAfter=5),
    'body': ParagraphStyle('body', fontName=font, fontSize=10.8, leading=19, wordWrap='CJK', spaceAfter=7),
}

COMMON_HEAD = [
    ('一 合同双方与专用约定', '甲方为托运的粮食贸易企业，乙方为承担全程运输组织责任的物流运营企业。双方名称、联系人、货物、起讫地、数量、运输总价、合同截止时间及作业要求见本合同附列的成交与专用约定。数量以吨计并保留一位小数；计量原始记录保留实际精度。'),
    ('二 货物申报与装载要求', '甲方如实申报粮食品种、品质、数量、装载形式及装卸要求，并提供交货所需资料。乙方检查车厢、货舱和集装箱的清洁、干燥、防雨及适载状态，防止受潮、污染、混装和散失。玉米关注霉变及水分，大豆关注破损和混杂，小麦关注受潮，稻谷关注混杂与包装；验收指标以双方确认的货物质量资料为准。'),
]
COMMON_TAIL = [
    ('五 计量与验收', '交接数量以经核验的过磅单、港站计量及签收资料为依据，核对毛重、皮重、净重、批次和计量时间。车辆出发前的计划数量不作为实际交付依据。数量或品质异常应及时通知双方并保存原始资料，运输损耗标准和复核办法须在专用约定中明确，不预设统一损耗比例。'),
    ('六 运输费用与对账', '运输总价、计价单位和付款条件以成交及专用约定为准。运费、装卸、换装、仓储、港口作业等费用注明是否已包含于运输总价；额外费用须写明事项、责任、金额和凭证。司机回传费用、合同费用和其他费用按同一全程运单归集，经双方确认后对账，避免同一作业重复收费。'),
    ('七 付款与票据', '付款节点、账期和支付方式以双方专用约定为准。对账应核验原始运输、计量、签收和费用资料；应开具的发票按约定提供。结算只使用经双方确认的企业收款信息，变更账户须再次核验。系统中的付款计划、金额或页面确认不代表实际银行收付。'),
    ('八 异常处理与责任', '发生晚点、封航、港站拥堵、货物毁损或短少时，乙方及时通知甲方，保存事实和原始资料并采取合理减损措施。货物毁损、灭失、迟延及免责事由按适用法律和双方约定处理；不能仅凭定位或预警自动认定责任。保险的险种、金额、投保人和理赔资料由双方另行明确。'),
    ('九 变更与运输完成', '变更路线、装载形式、时间、费用或交付地点，应取得双方确认并保留变更原因和资料。散改集须记录原批次、装箱数量、箱号及封号。全程运输完成时逐批核对收货与交接资料、未处理异常及费用；业务完成后生成全程运单账单，账单初始为未对账，不能据此认定已经付款。'),
    ('十 单据保存与数据使用', '甲乙双方按其业务身份使用合同及运输资料。车辆定位、船舶定位、铁路跟踪和预测信息用于运输协同，以已接入的来源和实际回传为准。资料上传须真实、完整，第三方单据不得伪造。合同、运单、回单、变更和费用记录按约定期限归档，数据授权范围单独确认。'),
    ('十一 生效与争议处理', '合同经双方依法完成签署后，按约定条件生效。电子签署以可核验的签署证据为准，展示的印章图案不构成已签署。发生争议时先协商处理；未能解决的，按专用约定中依法有效的管辖或仲裁条款处理，未作有效约定的按法律规定办理。'),
]
PLATFORM = [
    ('一 服务主体与关联范围', '本附加合同与运输主合同共同组成合同包。粮食贸易企业、物流运营企业、平台名称及关联承运确认见合同包专用约定，各方按照合同包的签署规则确认。本附加合同不自行设定运输数量、运价、预算或新增运输任务。'),
    ('二 平台服务内容', '平台提供供需发布、指定议价、方案和合同记录、联运协同、资料归集、轨迹查询、费用及对账信息服务。物流运营企业负责登记运输阶段和资源并回传业务资料，贸易企业可查阅其相关业务，平台按管理权限开展审核与协同。平台的信息服务不替代承运企业的全程运输责任。'),
    ('三 服务费用', '平台费用独立于运输总价，收费项目、金额、承担方、付款节点及发票要求见专用约定。没有双方确认的收费依据，不因使用某页面或查看数据而自动新增费用。合同变更涉及平台服务范围或费用时，同步保留新的确认记录。'),
    ('四 发布与报价权限', '公开供需信息在授权范围内展示；指定议价只对发布方选择的企业开放相应操作。报价、邀请、推荐、合同和费用资料按参与身份及业务归属授权，各企业只访问其有权查看的数据。发布方须确认所提供信息准确并及时处理撤回或变更。'),
    ('五 数据服务申请与授权', '物流运营企业、粮食贸易企业向平台申请数据服务，平台核对用途、产品、期限及范围后授权。平台不作为企业申请人。未经授权不得查询其他企业的定位、合同或费用明细；授权到期、撤回或主体状态变化时按服务规则处理。'),
    ('六 运输资料与定位信息', '运输企业和司机按真实作业上传计量、签收、箱号、封号及费用凭证。车辆、船舶和铁路轨迹注明来源、时间及可用状态；预警和预计到达时间是辅助判断信息，不替代原始作业单据或责任认定。企业应及时修正错误资料并保留修改记录。'),
    ('七 对账与收付边界', '平台按全程运单归集账单并记录双方核对过程。业务完成、账单生成和对账确认分别记录；付款和收款以实际银行凭证及核验结果为准。平台未接入相应支付或签署服务时，不以页面操作产生实际资金划转或电子签署证明。'),
    ('八 保密与资料保存', '各方仅为本业务使用获授权的信息，对合同、报价、联系人、定位和结算资料采取适当保护措施。涉及个人信息时，应按适用规定确认处理依据及使用范围。归档资料保留必要的版本、权限与操作记录，保存期限按双方约定及适用要求确定。'),
    ('九 服务异常与变更', '出现系统故障、外部定位中断、资料错误或权限异常时，平台记录问题并组织处理，相关企业补充真实作业资料。各方协商服务范围、费用、期限和授权的变更；运输紧急事项由承担运输责任的企业及时处理，不以系统状态代替实际通知。'),
    ('十 生效与争议处理', '本附加合同按合同包约定的确认或签署规则生效。未明确事项由相关方补充约定；争议先协商，协商不成的按依法有效的争议解决约定或适用法律处理。'),
]

def paragraph(text, kind='body'):
    return Paragraph(escape(text), styles[kind])

def section(heading, body):
    return KeepTogether([paragraph(heading, 'heading'), paragraph(body)])

def page_number(canvas, doc):
    canvas.setFont(font, 9)
    canvas.setFillColor(colors.HexColor('#606970'))
    canvas.drawRightString(A4[0]-48, 28, f'第 {doc.page} 页')

manifest = []
for item in LIBRARY['templates']:
    sections = PLATFORM if item['type']=='ADDENDUM' else COMMON_HEAD + item['operation'] + COMMON_TAIL
    code = 'LY-HT-2026-' + item['key'].upper()
    introduction = item['scope'] + '签约前核对适用运输组合，成交与专用约定和附件需由相关方确认。'
    signature = '托运方或贸易方确认人：____________    承运方确认人：____________\n签署日期：____________    签署地点：____________'
    content = '\n\n'.join([item['name'], '模板编号：'+code, introduction, '适用线路说明：'+item['routeReference']] + [h+'\n'+b for h,b in sections] + [signature])
    name = item['name']+'.pdf'
    doc = SimpleDocTemplate(str(OUTPUT/name), pagesize=A4, rightMargin=48, leftMargin=48, topMargin=44, bottomMargin=44, title=item['name'], author='辽粮联运平台', subject=item['scope'])
    story = [paragraph(item['name'], 'title'), paragraph('模板编号 '+code+'    条款整理日期 2026年10月3日', 'sub'), paragraph(introduction), paragraph('适用线路说明 '+item['routeReference'], 'sub')]
    # Explicit break preserves headings and gives each template two complete pages.
    split = 5 if item['type']=='ADDENDUM' else 6
    for i,(h,b) in enumerate(sections):
        if i==split: story.append(PageBreak())
        story.append(section(h,b))
    story.extend([Spacer(1,14),paragraph(signature.replace('\n','  '))])
    doc.build(story, onFirstPage=page_number, onLaterPages=page_number)
    (OUTPUT/(item['name']+'.txt')).write_text(content, encoding='utf-8')
    reader=PdfReader(OUTPUT/name)
    if len(reader.pages)!=2: raise ValueError(f'{name}: expected 2 pages, got {len(reader.pages)}')
    extracted='\n'.join(p.extract_text() or '' for p in reader.pages)
    if item['name'] not in extracted or sections[-1][0] not in extracted: raise ValueError('PDF text incomplete: '+name)
    manifest.append({**item, 'pdf':name, 'text':item['name']+'.txt', 'body':content, 'pages':len(reader.pages), 'code':code})
(OUTPUT/'manifest.json').write_text(json.dumps({'sourceSystem':LIBRARY['sourceSystem'], 'revision':LIBRARY['revision'], 'sources':LIBRARY['sources'], 'templates':manifest}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'output':str(OUTPUT),'templates':len(manifest),'pages':sum(t['pages'] for t in manifest)},ensure_ascii=False))
