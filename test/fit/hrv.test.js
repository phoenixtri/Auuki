import { dataviewToArray } from '../../src/functions.js';
import { fit } from '../../src/fit/fit.js';
import { appData, FITjs, fitBinary, flatFitBinary, } from './hrv-data.js';

describe('AppData', () => {

    test('DefinitionRecord.toFITjs', () => {
        const res = fit.definitionRecord.toFITjs(
            ['file_id', [
                'time_created',
                'manufacturer',
                'product',
                'serial_number',
                'number',
                'type',
            ], 0],
        );

        expect(res).toEqual({
            type: 'definition',
            name: 'file_id',
            architecture: 0,
            local_number: 0,
            length: 24,
            data_record_length: 16,
            fields: [
                {number: 4, size: 4, base_type: 'uint32'},
                {number: 1, size: 2, base_type: 'uint16'},
                {number: 2, size: 2, base_type: 'uint16'},
                {number: 3, size: 4, base_type: 'uint32z'},
                {number: 5, size: 2, base_type: 'uint16'},
                {number: 0, size: 1, base_type: 'enum'},
            ],
            dev_fields: [],
        });
    });

    test('DefinitionRecord.toFITjs Array', () => {
        const res = fit.definitionRecord.toFITjs(
            ['hrv', [['time', 10],], 4],
        );

        expect(res).toEqual({
            type: 'definition',
            name: 'hrv',
            architecture: 0,
            local_number: 4,
            length: 9,
            data_record_length: 11,
            fields: [
                {number: 0, size: 10, base_type: 'uint16'}, // time
            ],
            dev_fields: [],
        });
    });

    test('DataRecord.encode Array', () => {
        const view = new DataView(new ArrayBuffer(11));
        // const definition = fit.definitionRecord.toFITjs(['hrv', [['time', 10],], 4]);
        const definition = {
            type: 'definition',
            name: 'hrv',
            architecture: 0,
            local_number: 4,
            length: 9,
            data_record_length: 11,
            fields: [
                {number: 0, size: 10, base_type: 'uint16'}, // time
            ],
            dev_fields: [],
        };
        const data = {time: [882, 906, 0xFFFF, 0xFFFF, 0xFFFF],};
        const array = [];
        const expected = {
            type: 'data',
            name: 'hrv',
            local_number: 4,
            length: 11,
            fields: {time: [882, 906, 0xFFFF, 0xFFFF, 0xFFFF],}
        };

        const encoded = fit.dataRecord.encode(definition, data, view, 0);
        const decoded = fit.dataRecord.decode(definition, view, 0);
        console.log(new Uint8Array(encoded.buffer));

        expect(decoded).toEqual(expected);
    });

    test.skip('toFITjs', () => {
        const res = fit.localActivity.toFITjs({
            records: appData.records,
            laps: appData.laps,
        });

        expect(res).toEqual(FITjs({crc: false}));
    });

    /*
    test('encode', () => {
        // res: Dataview
        const res = fit.localActivity.encode({
            records: appData.records,
            laps: appData.laps,
        });
        // resArray: [Int]
        const resArray = dataviewToArray(res);

        expect(resArray).toEqual(flatFitBinary);

        // check CRC
        var headerCRC     = fit.CRC.calculateCRC(
            new DataView(new Uint8Array(fitBinary[0]).buffer), 0, 11);
        var fileCRC       = fit.CRC.calculateCRC(
            new DataView(new Uint8Array(flatFitBinary).buffer),
            0,
            (flatFitBinary.length - 1) - fit.CRC.size,
        );
        var headerCRCArray = fit.CRC.toArray(headerCRC);
        var fileCRCArray   = fit.CRC.toArray(fileCRC);

        console.log(`header crc: ${headerCRC} `, headerCRCArray);
        console.log(`file crc: ${fileCRC} `, fileCRCArray);

        var resHeaderCRCArray = fit.CRC.getHeaderCRC(res).array;

        var resFileCRCArray = fit.CRC.getFileCRC(res).array;

        expect(resHeaderCRCArray).toEqual(headerCRCArray);

        expect(resFileCRCArray).toEqual(fileCRCArray);
        // check CRC
    });

    test('decode', () => {
        const array = new Uint8Array(fitBinary.flat());
        const view = new DataView(array.buffer);

        const res = fit.FITjs.decode(view);

        expect(res).toEqual(FITjs({crc: true}));
    });
    */
});
