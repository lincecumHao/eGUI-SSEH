define(['N/record', 'N/search', 'N/format', 'N/error'], function (
  record,
  search,
  format,
  error
) {
  /**
   * @NApiVersion 2.x
   * @NScriptType UserEventScript
   * @NModuleScope Public
   */
  var exports = {}

  var _duration_seconds = 30000

  function searchVoucherByNumber(voucher_number) {
    var _internalid
    try {
      var _mySearch = search.create({
        type: 'customrecord_gw_voucher_main',
        columns: [
          search.createColumn({ name: 'custrecord_gw_voucher_number' }),
          search.createColumn({ name: 'custrecord_gw_tax_type' }),
          search.createColumn({ name: 'custrecord_gw_voucher_date' })
        ]
      })

      var _filterArray = []
      _filterArray.push(['custrecord_gw_voucher_number', 'is', voucher_number])
      _mySearch.filterExpression = _filterArray

      _mySearch.run().each(function (result) {
        _internalid = result.id
        return true
      })
    } catch (e) {
      log.error(e.name, e.message)
    }

    return _internalid
  }

  function searchVoucherByInternalId(internal_id) {
    var _internalid
    try {
      var _mySearch = search.create({
        type: 'customrecord_gw_voucher_details',
        columns: [
          search.createColumn({ name: 'custrecord_gw_original_gui_number' }),
          search.createColumn({ name: 'custrecord_gw_original_gui_date' }),
          search.createColumn({
            name: 'custrecord_gw_voucher_main_internal_id'
          })
        ]
      })

      var _filterArray = []
      _filterArray.push([
        'custrecord_gw_ns_document_apply_id',
        'is',
        internal_id
      ])
      _mySearch.filterExpression = _filterArray

      log.debug('filterArray=', JSON.stringify(_filterArray))
      _mySearch.run().each(function (result) {
        var _result = JSON.parse(JSON.stringify(result))
        if (_result.values.custrecord_gw_voucher_main_internal_id.length != 0) {
          _internalid =
            _result.values.custrecord_gw_voucher_main_internal_id[0].value //54
        }

        return true
      })
    } catch (e) {
      log.error(e.name, e.message)
    }

    return _internalid
  }

  function convertExportDate(export_date) {
    if (!export_date) return ''
    var _tradition_date //民國年月日(1101231)

    try {
      var _date = new Date(export_date)

      var _year = _date.getFullYear() - 1911
      var _month = _date.getMonth() + 1
      if (_month < 10) {
        _month = '0' + _month
      }
      var _day = _date.getDate()
      if (_day < 10) {
        _day = '0' + _day
      }

      _tradition_date = _year + '' + _month + '' + _day
    } catch (e) {
      log.error(e.name, e.message)
    }

    return _tradition_date
  }

  function saveToVoucherMain(
    internalid,
    applicable_zero_tax,
    egui_clearance_mark,
    customs_export_category,
    customs_export_no,
    customs_export_date
  ) {
    try {
      var values = {}
      values['custrecord_gw_applicable_zero_tax'] = applicable_zero_tax
      values['custrecord_gw_clearance_mark'] = egui_clearance_mark.toString()
      values['custrecord_gw_customs_export_category'] = customs_export_category
      values['custrecord_gw_customs_export_no'] = customs_export_no
      values['custrecord_gw_customs_export_date'] = customs_export_date
      log.debug(
        'saveToVoucherMain',
        'internalid=' + internalid + ', values=' + values
      )
      var _id = record.submitFields({
        type: 'customrecord_gw_voucher_main',
        id: internalid,
        values: values,
        options: {
          enableSourcing: false,
          ignoreMandatoryFields: true
        }
      })
    } catch (e) {
      log.error(e.name, e.message)
    }
  }

  function afterSubmit(context) {
    var currentEvidenceIssueStatus = context.newRecord.getValue({fieldId: 'custbody_gw_evidence_issue_status'})
    try {
      if (currentEvidenceIssueStatus !== getExportSalesStatusId() && context.type === context.UserEventType.EDIT) {
        var _current_record = context.newRecord

        //發票號碼
        var _gui_num_start = _current_record.getValue({
          fieldId: 'custbody_gw_gui_num_start'
        })
        var _gui_num_end = _current_record.getValue({
          fieldId: 'custbody_gw_gui_num_end'
        })
        //折讓單號碼
        var _allowance_num_start = _current_record.getValue({
          fieldId: 'custbody_gw_allowance_num_start'
        })
        var _allowance_num_end = _current_record.getValue({
          fieldId: 'custbody_gw_allowance_num_end'
        })
        //零稅率註記
        var _applicable_zero_tax_id = _current_record.getValue({
          fieldId: 'custbody_gw_applicable_zero_tax'
        })
        //通關註記
        var _egui_clearance_mark_id = _current_record.getValue({
          fieldId: 'custbody_gw_egui_clearance_mark'
        })
        //海關出口單類別
        var _customs_export_category_id = _current_record.getValue({
          fieldId: 'custbody_gw_customs_export_category'
        })
        //海關出口號碼
        var _customs_export_no = _current_record.getValue({
          fieldId: 'custbody_gw_customs_export_no'
        })
        //輸出或結匯日期
        var _customs_export_date = _current_record.getValue({
          fieldId: 'custbody_gw_customs_export_date'
        })

        if (_gui_num_start !== '' || _allowance_num_start != '') {
          //save to voucher main
          /**
          var _internalid =
            _gui_num_start.length != 0
              ? searchVoucherByNumber(_gui_num_start)
              : searchVoucherByNumber(_allowance_num_start)
          */
          var _internalid = searchVoucherByInternalId(_current_record.id)

          var _tradition_date = convertExportDate(_customs_export_date)
          //通關註記
          var _egui_clearance_mark = ''
          if (_egui_clearance_mark_id.length != 0) {
            var _ap_doc_custom_option_record = record.load({
              type: 'customrecord_gw_ap_doc_custom_option',
              id: _egui_clearance_mark_id,
              isDynamic: true
            })
            _egui_clearance_mark = _ap_doc_custom_option_record.getValue({
              fieldId: 'custrecord_gw_ap_doc_custom_value'
            })
          }

          //適用零稅率註記選項
          var _applicable_zero_tax = ''
          if (_applicable_zero_tax_id.length != 0) {
            var _ap_doc_exempt_option_record = record.load({
              type: 'customrecord_gw_ap_doc_exempt_option',
              id: _applicable_zero_tax_id,
              isDynamic: true
            })
            _applicable_zero_tax = _ap_doc_exempt_option_record.getValue({
              fieldId: 'custrecord_gw_ap_doc_exempt_value'
            })
          }
          //零稅率註記類別
          var _customs_export_category = ''
          if (_customs_export_category_id.length != 0) {
            var _customs_export_category_record = record.load({
              type: 'customrecord_gw_customs_export_category',
              id: _customs_export_category_id,
              isDynamic: true
            })
            _customs_export_category = _customs_export_category_record.getValue(
              { fieldId: 'custrecord_gw_customers_export_cate_id' }
            )
          }

          //1:非經海關的資料應填寫證明文件名稱與號碼=>不寫入
          if (_egui_clearance_mark == '1') {
            _customs_export_no = '' //海關出口報單號碼-14碼
            _customs_export_category = '' //海關出口報單類別
          }

          saveToVoucherMain(
            _internalid,
            _applicable_zero_tax,
            _egui_clearance_mark,
            _customs_export_category,
            _customs_export_no,
            _tradition_date
          )
        }
      }
    } catch (e) {
      log.error(e.name, e.message)
    }
  }

  function beforeSubmit(context) {
    var currentEvidenceIssueStatus = context.newRecord.getValue({fieldId: 'custbody_gw_evidence_issue_status'})
    if (currentEvidenceIssueStatus !== getExportSalesStatusId() && context.type === context.UserEventType.EDIT) {
      if (!validateCustomsExportNumberLength(context)) {
        throw error.create({
          name: '零稅率資訊',
          message: '海關出口報單號碼長度須為14碼,海關出口報單類別不可空白!',
          notifyOff: true
        })
      }
    }
  }

  //驗證資料
  function validateCustomsExportNumberLength(context) {
    var _result = true
    try {
      var _current_record = context.newRecord
      //海關出口號碼
      var _customs_export_no = _current_record.getValue({
        fieldId: 'custbody_gw_customs_export_no'
      })
      //通關註記 1-非經海關 2-經海關
      //非經海關的資料應填寫證明文件名稱與號碼；經海關才是報單號碼與報單類別。現在的欄位帶入有誤
      var _egui_clearance_mark = ''
      var _egui_clearance_mark_id = _current_record.getValue({
        fieldId: 'custbody_gw_egui_clearance_mark'
      })
      if (_egui_clearance_mark_id.length != 0) {
        var _ap_doc_custom_option_record = record.load({
          type: 'customrecord_gw_ap_doc_custom_option',
          id: _egui_clearance_mark_id,
          isDynamic: true
        })
        _egui_clearance_mark = _ap_doc_custom_option_record.getValue({
          fieldId: 'custrecord_gw_ap_doc_custom_value'
        })
      }
      log.error('通關註記', 'egui_clearance_mark=' + _egui_clearance_mark)

      //海關出口報單類別
      var _customs_export_category_id = _current_record.getValue({
        fieldId: 'custbody_gw_customs_export_category'
      })

      if (
        _egui_clearance_mark == '2' &&
        (_customs_export_category_id.length == 0 ||
          _customs_export_no.length != 14)
      ) {
        _result = false
      }
    } catch (e) {
      log.error(e.name, e.message)
    }
    return _result
  }

  function getExportSalesStatusId() {
    var exportSalesStatusId = null
    var filters = [];
    filters.push(['custrecord_gw_evidence_status_value', 'is', 'ES']);
    var columns = [];
    columns.push('custrecord_gw_evidence_status_value');
    columns.push('custrecord_gw_evidence_status_text');
    var getExportSalesEvidenceStatusSearchObj = search.create({
      type: 'customrecord_gw_evidence_status',
      filters: filters,
      columns: columns,
    });
    getExportSalesEvidenceStatusSearchObj.run().each(function(result){
      // .run().each has a limit of 4,000 results
      exportSalesStatusId = result.id;
      return true;
    })

    return exportSalesStatusId;
  }

  exports.beforeSubmit = beforeSubmit
  exports.afterSubmit = afterSubmit

  return exports
})
